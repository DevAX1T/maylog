// https://github.com/mike-marcacci/node-redlock/blob/main/src/index.ts
import { AbortController as PolyfillAbortController } from "node-abort-controller";
import { EventEmitter } from "events";
import { randomBytes, createHash } from "crypto";
import { Redis as IORedisClient, Cluster as IORedisCluster } from "ioredis";
import Global from '../../Global';

type Client = IORedisClient | IORedisCluster;

// Define script constants.
const ACQUIRE_SCRIPT = `
  -- Return 0 if an entry already exists.
  for i, key in ipairs(KEYS) do
    if redis.call("exists", key) == 1 then
      return 0
    end
  end

  -- Create an entry for each provided key.
  for i, key in ipairs(KEYS) do
    redis.call("set", key, ARGV[1], "PX", ARGV[2])
  end

  -- Return the number of entries added.
  return #KEYS
`;

const EXTEND_SCRIPT = `
  -- Return 0 if an entry exists with a *different* lock value.
  for i, key in ipairs(KEYS) do
    if redis.call("get", key) ~= ARGV[1] then
      return 0
    end
  end

  -- Update the entry for each provided key.
  for i, key in ipairs(KEYS) do
    redis.call("set", key, ARGV[1], "PX", ARGV[2])
  end

  -- Return the number of entries updated.
  return #KEYS
`;

const RELEASE_SCRIPT = `
  local count = 0
  for i, key in ipairs(KEYS) do
    -- Only remove entries for *this* lock value.
    if redis.call("get", key) == ARGV[1] then
      redis.pcall("del", key)
      count = count + 1
    end
  end

  -- Return the number of entries removed.
  return count
`;

export type ClientExecutionResult =
  | {
      client: Client;
      vote: "for";
      value: number;
    }
  | {
      client: Client;
      vote: "against";
      error: Error;
    };

/*
 * This object contains a summary of results.
 */
export type ExecutionStats = {
  readonly membershipSize: number;
  readonly quorumSize: number;
  readonly votesFor: Set<Client>;
  readonly votesAgainst: Map<Client, Error>;
};

/*
 * This object contains a summary of results. Because the result of an attempt
 * can sometimes be determined before all requests are finished, each attempt
 * contains a Promise that will resolve ExecutionStats once all requests are
 * finished. A rejection of these promises should be considered undefined
 * behavior and should cause a crash.
 */
export type ExecutionResult = {
  attempts: ReadonlyArray<Promise<ExecutionStats>>;
  start: number;
};

/**
 *
 */
export interface Settings {
  /**
   * The expected clock drift. See [Distributed Locks](http://redis.io/topics/distlock)
   * @default 0.01
   */
  readonly driftFactor: number;
  /** The max number of times Redlock will attempt to lock a resource before erroring
   * @default 10
   */
  readonly retryCount: number;
  /**
   * The time in ms between attempts
   * @default 200
   */
  readonly retryDelay: number;
  /**
   * The max time in ms randomly added to retries to improve performance under
   * high contention. See [AWS Architecture](https://www.awsarchitectureblog.com/2015/03/backoff.html)
   * @default 200
   */
  readonly retryJitter: number;
  /**
   * The minimum remaining time on a lock (in ms) before an extension is automatically attempted with the `using` API.
   * @default 500
   */
  readonly automaticExtensionThreshold: number;
  /**
   * The duration to acquire a lock for in ms.
   * @default 60000
   */
  readonly duration: number;
  /**
   * The base category name to use for all locks
   * @default redlock
   */
  readonly name: string;
}

// Define default settings.
const defaultSettings: Readonly<Settings> = {
  driftFactor: 0.01,
  retryCount: 10,
  retryDelay: 200,
  retryJitter: 100,
  automaticExtensionThreshold: 500,
  duration: 60000,
  name: 'locks'
};

// Modifyng this object is forbidden.
Object.freeze(defaultSettings);

/*
 * This error indicates a failure due to the existence of another lock for one
 * or more of the requested resources.
 */
export class ResourceLockedError extends Error {
  constructor(public readonly message: string) {
    super();
    this.name = "ResourceLockedError";
  }
}

/*
 * This error indicates a failure of an operation to pass with a quorum.
 */
export class ExecutionError extends Error {
  constructor(
    public readonly message: string,
    public readonly attempts: ReadonlyArray<Promise<ExecutionStats>>
  ) {
    super();
    this.name = "ExecutionError";
  }
}

/*
 * An object of this type is returned when a resource is successfully locked. It
 * contains convenience methods `release` and `extend` which perform the
 * associated Redlock method on itself.
 */
export class Lock {
  constructor(
    public readonly redlock: Redlock,
    public readonly resources: string[],
    public readonly value: string,
    public readonly attempts: ReadonlyArray<Promise<ExecutionStats>>,
    public expiration: number
  ) {}

  async release(): Promise<ExecutionResult> {
    return this.redlock.release(this);
  }

  async extend(duration: number): Promise<Lock> {
    return this.redlock.extend(this, duration);
  }
}

export type RedlockAbortSignal = AbortSignal & { error?: Error };

/**
 * A redlock object is instantiated with an array of at least one redis client
 * and an optional `options` object. Properties of the Redlock object should NOT
 * be changed after it is first used, as doing so could have unintended
 * consequences for live locks.
 */
export default class Redlock extends EventEmitter {
  public readonly clients: Set<Client>;
  public readonly settings: Settings;
  public readonly scripts: {
    readonly acquireScript: { value: string; hash: string };
    readonly extendScript: { value: string; hash: string };
    readonly releaseScript: { value: string; hash: string };
  };

  public constructor(
    clients: Iterable<Client>,
    settings: Partial<Settings> = {},
    scripts: {
      readonly acquireScript?: string | ((script: string) => string);
      readonly extendScript?: string | ((script: string) => string);
      readonly releaseScript?: string | ((script: string) => string);
    } = {}
  ) {
    super();

    // Prevent crashes on error events.
    this.on("error", () => {
      // Because redlock is designed for high availability, it does not care if
      // a minority of redis instances/clusters fail at an operation.
      //
      // However, it can be helpful to monitor and log such cases. Redlock emits
      // an "error" event whenever it encounters an error, even if the error is
      // ignored in its normal operation.
      //
      // This function serves to prevent node's default behavior of crashing
      // when an "error" event is emitted in the absence of listeners.
    });

    // Create a new array of client, to ensure no accidental mutation.
    this.clients = new Set(clients);
    if (this.clients.size === 0) {
      throw new Error(
        "Redlock must be instantiated with at least one redis client."
      );
    }

    // Customize the settings for this instance.
    this.settings = {
      driftFactor:
        typeof settings.driftFactor === "number"
          ? settings.driftFactor
          : defaultSettings.driftFactor,
      retryCount:
        typeof settings.retryCount === "number"
          ? settings.retryCount
          : defaultSettings.retryCount,
      retryDelay:
        typeof settings.retryDelay === "number"
          ? settings.retryDelay
          : defaultSettings.retryDelay,
      retryJitter:
        typeof settings.retryJitter === "number"
          ? settings.retryJitter
          : defaultSettings.retryJitter,
      automaticExtensionThreshold:
        typeof settings.automaticExtensionThreshold === "number"
          ? settings.automaticExtensionThreshold
          : defaultSettings.automaticExtensionThreshold,
      duration:
        typeof settings.duration === "number"
          ? settings.duration
          : defaultSettings.duration,
      name: 
        typeof settings.name === 'string'
          ? settings.name
          : defaultSettings.name,
    };

    // Use custom scripts and script modifiers.
    const acquireScript =
      typeof scripts.acquireScript === "function"
        ? scripts.acquireScript(ACQUIRE_SCRIPT)
        : ACQUIRE_SCRIPT;
    const extendScript =
      typeof scripts.extendScript === "function"
        ? scripts.extendScript(EXTEND_SCRIPT)
        : EXTEND_SCRIPT;
    const releaseScript =
      typeof scripts.releaseScript === "function"
        ? scripts.releaseScript(RELEASE_SCRIPT)
        : RELEASE_SCRIPT;

    this.scripts = {
      acquireScript: {
        value: acquireScript,
        hash: this._hash(acquireScript),
      },
      extendScript: {
        value: extendScript,
        hash: this._hash(extendScript),
      },
      releaseScript: {
        value: releaseScript,
        hash: this._hash(releaseScript),
      },
    };
  }

  /**
   * Generate a sha1 hash compatible with redis evalsha.
   */
  private _hash(value: string): string {
    return createHash("sha1").update(value).digest("hex");
  }

  /**
   * Generate a cryptographically random string.
   */
  private _random(): string {
    return randomBytes(16).toString("hex");
  }

  /**
   * This method runs `.quit()` on all client connections.
   */
  public async quit(): Promise<void> {
    const results = [];
    for (const client of this.clients) {
      results.push(client.quit());
    }

    await Promise.all(results);
  }

  /**
   * This method acquires a locks on the resources for the duration specified by
   * the `duration`.
   */
  public async acquire(
    resources: string[],
    duration?: number,
    settings?: Partial<Settings>
  ): Promise<Lock> {
    resources = resources.map(r => `${Global.db}:${settings?.name ?? this.settings.name}:${r}`);
    if (!duration) duration = this.settings.duration;
    if (Math.floor(duration) !== duration) {
      throw new Error("Duration must be an integer value in milliseconds.");
    }

    const value = this._random();

    try {
      const { attempts, start } = await this._execute(
        this.scripts.acquireScript,
        resources,
        [value, duration],
        settings
      );

      // Add 2 milliseconds to the drift to account for Redis expires precision,
      // which is 1 ms, plus the configured allowable drift factor.
      const drift =
        Math.round(
          (settings?.driftFactor ?? this.settings.driftFactor) * duration
        ) + 2;

      return new Lock(
        this,
        resources,
        value,
        attempts,
        start + duration - drift
      );
    } catch (error) {
      // If there was an error acquiring the lock, release any partial lock
      // state that may exist on a minority of clients.
      await this._execute(this.scripts.releaseScript, resources, [value], {
        retryCount: 0,
      }).catch(() => {
        // Any error here will be ignored.
      });

      throw error;
    }
  }

  /**
   * This method unlocks the provided lock from all servers still persisting it.
   * It will fail with an error if it is unable to release the lock on a quorum
   * of nodes, but will make no attempt to restore the lock in the case of a
   * failure to release. It is safe to re-attempt a release or to ignore the
   * error, as the lock will automatically expire after its timeout.
   */
  public async release(
    lock: Lock,
    settings?: Partial<Settings>
  ): Promise<ExecutionResult> {
    // Immediately invalidate the lock.
    lock.expiration = 0;

    // Attempt to release the lock.
    return this._execute(
      this.scripts.releaseScript,
      lock.resources,
      [lock.value],
      settings
    );
  }

  /**
   * This method extends a valid lock by the provided `duration`.
   */
  public async extend(
    existing: Lock,
    duration: number,
    settings?: Partial<Settings>
  ): Promise<Lock> {
    if (Math.floor(duration) !== duration) {
      throw new Error("Duration must be an integer value in milliseconds.");
    }

    // The lock has already expired.
    if (existing.expiration < Date.now()) {
      throw new ExecutionError("Cannot extend an already-expired lock.", []);
    }

    const { attempts, start } = await this._execute(
      this.scripts.extendScript,
      existing.resources,
      [existing.value, duration],
      settings
    );

    // Invalidate the existing lock.
    existing.expiration = 0;

    // Add 2 milliseconds to the drift to account for Redis expires precision,
    // which is 1 ms, plus the configured allowable drift factor.
    const drift =
      Math.round(
        (settings?.driftFactor ?? this.settings.driftFactor) * duration
      ) + 2;

    const replacement = new Lock(
      this,
      existing.resources,
      existing.value,
      attempts,
      start + duration - drift
    );

    return replacement;
  }

  /**
   * Execute a script on all clients. The resulting promise is resolved or
   * rejected as soon as this quorum is reached; the resolution or rejection
   * will contains a `stats` property that is resolved once all votes are in.
   */
  private async _execute(
    script: { value: string; hash: string },
    keys: string[],
    args: (string | number)[],
    _settings?: Partial<Settings>
  ): Promise<ExecutionResult> {
    const settings = _settings
      ? {
          ...this.settings,
          ..._settings,
        }
      : this.settings;

    // For the purpose of easy config serialization, we treat a retryCount of
    // -1 a equivalent to Infinity.
    const maxAttempts =
      settings.retryCount === -1 ? Infinity : settings.retryCount + 1;

    const attempts: Promise<ExecutionStats>[] = [];

    while (true) {
      const { vote, stats, start } = await this._attemptOperation(
        script,
        keys,
        args
      );

      attempts.push(stats);

      // The operation achieved a quorum in favor.
      if (vote === "for") {
        return { attempts, start };
      }

      // Wait before reattempting.
      if (attempts.length < maxAttempts) {
        await new Promise((resolve) => {
          setTimeout(
            resolve,
            Math.max(
              0,
              settings.retryDelay +
                Math.floor((Math.random() * 2 - 1) * settings.retryJitter)
            ),
            undefined
          );
        });
      } else {
        throw new ExecutionError(
          "The operation was unable to achieve a quorum during its retry window.",
          attempts
        );
      }
    }
  }

  private async _attemptOperation(
    script: { value: string; hash: string },
    keys: string[],
    args: (string | number)[]
  ): Promise<
    | { vote: "for"; stats: Promise<ExecutionStats>; start: number }
    | { vote: "against"; stats: Promise<ExecutionStats>; start: number }
  > {
    const start = Date.now();

    return await new Promise((resolve) => {
      const clientResults = [];
      for (const client of this.clients) {
        clientResults.push(
          this._attemptOperationOnClient(client, script, keys, args)
        );
      }

      const stats: ExecutionStats = {
        membershipSize: clientResults.length,
        quorumSize: Math.floor(clientResults.length / 2) + 1,
        votesFor: new Set<Client>(),
        votesAgainst: new Map<Client, Error>(),
      };

      let done: () => void;
      const statsPromise = new Promise<typeof stats>((resolve) => {
        done = () => resolve(stats);
      });

      // This is the expected flow for all successful and unsuccessful requests.
      const onResultResolve = (clientResult: ClientExecutionResult): void => {
        switch (clientResult.vote) {
          case "for":
            stats.votesFor.add(clientResult.client);
            break;
          case "against":
            stats.votesAgainst.set(clientResult.client, clientResult.error);
            break;
        }

        // A quorum has determined a success.
        if (stats.votesFor.size === stats.quorumSize) {
          resolve({
            vote: "for",
            stats: statsPromise,
            start,
          });
        }

        // A quorum has determined a failure.
        if (stats.votesAgainst.size === stats.quorumSize) {
          resolve({
            vote: "against",
            stats: statsPromise,
            start,
          });
        }

        // All votes are in.
        if (
          stats.votesFor.size + stats.votesAgainst.size ===
          stats.membershipSize
        ) {
          done();
        }
      };

      // This is unexpected and should crash to prevent undefined behavior.
      const onResultReject = (error: Error): void => {
        throw error;
      };

      for (const result of clientResults) {
        result.then(onResultResolve, onResultReject);
      }
    });
  }

  private async _attemptOperationOnClient(
    client: Client,
    script: { value: string; hash: string },
    keys: string[],
    args: (string | number)[]
  ): Promise<ClientExecutionResult> {
    try {
      let result: number;
      try {
        // Attempt to evaluate the script by its hash.
        //@ts-ignore
        const shaResult = (await client.evalsha(script.hash, keys.length, [
          ...keys,
          ...args,
        ])) as unknown;

        if (typeof shaResult !== "number") {
          throw new Error(
            `Unexpected result of type ${typeof shaResult} returned from redis.`
          );
        }

        result = shaResult;
      } catch (error) {
        // If the redis server does not already have the script cached,
        // reattempt the request with the script's raw text.
        if (
          !(error instanceof Error) ||
          !error.message.startsWith("NOSCRIPT")
        ) {
          throw error;
        }
        //@ts-ignore
        const rawResult = (await client.eval(script.value, keys.length, [
          ...keys,
          ...args,
        ])) as unknown;

        if (typeof rawResult !== "number") {
          throw new Error(
            `Unexpected result of type ${typeof rawResult} returned from redis.`
          );
        }

        result = rawResult;
      }

      // One or more of the resources was already locked.
      if (result !== keys.length) {
        throw new ResourceLockedError(
          `The operation was applied to: ${result} of the ${keys.length} requested resources.`
        );
      }

      return {
        vote: "for",
        client,
        value: result,
      };
    } catch (error) {
      if (!(error instanceof Error)) {
        throw new Error(
          `Unexpected type ${typeof error} thrown with value: ${error}`
        );
      }

      // Emit the error on the redlock instance for observability.
      this.emit("error", error);

      return {
        vote: "against",
        client,
        error,
      };
    }
  }

  /**
   * Wrap and execute a routine in the context of an auto-extending lock,
   * returning a promise of the routine's value. In the case that auto-extension
   * fails, an AbortSignal will be updated to indicate that abortion of the
   * routine is in order, and to pass along the encountered error.
   *
   * @example
   * ```ts
   * await redlock.using([senderId, recipientId], 5000, { retryCount: 5 }, async (signal) => {
   *   const senderBalance = await getBalance(senderId);
   *   const recipientBalance = await getBalance(recipientId);
   *
   *   if (senderBalance < amountToSend) {
   *     throw new Error("Insufficient balance.");
   *   }
   *
   *   // The abort signal will be true if:
   *   // 1. the above took long enough that the lock needed to be extended
   *   // 2. redlock was unable to extend the lock
   *   //
   *   // In such a case, exclusivity can no longer be guaranteed for further
   *   // operations, and should be handled as an exceptional case.
   *   if (signal.aborted) {
   *     throw signal.error;
   *   }
   *
   *   await setBalances([
   *     {id: senderId, balance: senderBalance - amountToSend},
   *     {id: recipientId, balance: recipientBalance + amountToSend},
   *   ]);
   * });
   * ```
   */

  public async using<T>(
    resources: string[],
    duration: number,
    settings: Partial<Settings>,
    routine?: (signal: RedlockAbortSignal) => Promise<T>
  ): Promise<T>;

  public async using<T>(
    resources: string[],
    duration: number,
    routine: (signal: RedlockAbortSignal) => Promise<T>
  ): Promise<T>;

  public async using<T>(
    resources: string[],
    duration: number,
    settingsOrRoutine:
      | undefined
      | Partial<Settings>
      | ((signal: RedlockAbortSignal) => Promise<T>),
    optionalRoutine?: (signal: RedlockAbortSignal) => Promise<T>
  ): Promise<T> {
    if (Math.floor(duration) !== duration) {
      throw new Error("Duration must be an integer value in milliseconds.");
    }

    const settings =
      settingsOrRoutine && typeof settingsOrRoutine !== "function"
        ? {
            ...this.settings,
            ...settingsOrRoutine,
          }
        : this.settings;

    const routine = optionalRoutine ?? settingsOrRoutine;
    if (typeof routine !== "function") {
      throw new Error("INVARIANT: routine is not a function.");
    }

    if (settings.automaticExtensionThreshold > duration - 100) {
      throw new Error(
        "A lock `duration` must be at least 100ms greater than the `automaticExtensionThreshold` setting."
      );
    }

    // The AbortController/AbortSignal pattern allows the routine to be notified
    // of a failure to extend the lock, and subsequent expiration. In the event
    // of an abort, the error object will be made available at `signal.error`.
    const controller =
      typeof AbortController === "undefined"
        ? new PolyfillAbortController()
        : new AbortController();

    const signal = controller.signal as RedlockAbortSignal;

    function queue(): void {
      timeout = setTimeout(
        () => (extension = extend()),
        lock.expiration - Date.now() - settings.automaticExtensionThreshold
      );
    }

    async function extend(): Promise<void> {
      timeout = undefined;

      try {
        lock = await lock.extend(duration);
        queue();
      } catch (error) {
        if (!(error instanceof Error)) {
          throw new Error(`Unexpected thrown ${typeof error}: ${error}.`);
        }

        if (lock.expiration > Date.now()) {
          return (extension = extend());
        }

        signal.error = error instanceof Error ? error : new Error(`${error}`);
        controller.abort();
      }
    }

    let timeout: undefined | NodeJS.Timeout;
    let extension: undefined | Promise<void>;
    let lock = await this.acquire(resources, duration, settings);
    queue();

    try {
      return await routine(signal);
    } finally {
      // Clean up the timer.
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }

      // Wait for an in-flight extension to finish.
      if (extension) {
        await extension.catch(() => {
          // An error here doesn't matter at all, because the routine has
          // already completed, and a release will be attempted regardless. The
          // only reason for waiting here is to prevent possible contention
          // between the extension and release.
        });
      }

      await lock.release();
    }
  }
}
/**
 * =  README.MD FILE =
 * [![Continuous Integration](https://github.com/mike-marcacci/node-redlock/workflows/Continuous%20Integration/badge.svg)](https://github.com/mike-marcacci/node-redlock/actions/workflows/ci.yml?query=branch%3Amain++)
[![Current Version](https://badgen.net/npm/v/redlock)](https://npm.im/redlock)
[![Supported Node.js Versions](https://badgen.net/npm/node/redlock)](https://npm.im/redlock)

# Redlock

This is a node.js implementation of the [redlock](http://redis.io/topics/distlock) algorithm for distributed redis locks. It provides strong guarantees in both single-redis and multi-redis environments, and provides fault tolerance through use of multiple independent redis instances or clusters.

- [Installation](#installation)
- [Usage](#usage)
- [Error Handling](#error-handling)
- [API](#api)
- [Guidance](#guidance)

## Installation

```bash
npm install --save redlock
```

## Configuration

Redlock is designed to use [ioredis](https://github.com/luin/ioredis) to keep its client connections and handle the cluster protocols.

A redlock object is instantiated with an array of at least one redis client and an optional `options` object. Properties of the Redlock object should NOT be changed after it is first used, as doing so could have unintended consequences for live locks.

```ts
import Client from "ioredis";
import Redlock from "redlock";

const redisA = new Client({ host: "a.redis.example.com" });
const redisB = new Client({ host: "b.redis.example.com" });
const redisC = new Client({ host: "c.redis.example.com" });

const redlock = new Redlock(
  // You should have one client for each independent redis node
  // or cluster.
  [redisA, redisB, redisC],
  {
    // The expected clock drift; for more details see:
    // http://redis.io/topics/distlock
    driftFactor: 0.01, // multiplied by lock ttl to determine drift time

    // The max number of times Redlock will attempt to lock a resource
    // before erroring.
    retryCount: 10,

    // the time in ms between attempts
    retryDelay: 200, // time in ms

    // the max time in ms randomly added to retries
    // to improve performance under high contention
    // see https://www.awsarchitectureblog.com/2015/03/backoff.html
    retryJitter: 200, // time in ms

    // The minimum remaining time on a lock before an extension is automatically
    // attempted with the `using` API.
    automaticExtensionThreshold: 500, // time in ms
  }
);
```

## Usage

The `using` method wraps and executes a routine in the context of an auto-extending lock, returning a promise of the routine's value. In the case that auto-extension fails, an AbortSignal will be updated to indicate that abortion of the routine is in order, and to pass along the encountered error.

The first parameter is an array of resources to lock; the second is the requested lock duration in milliseconds, which MUST NOT contain values after the decimal.

```ts
await redlock.using([senderId, recipientId], 5000, async (signal) => {
  // Do something...
  await something();

  // Make sure any attempted lock extension has not failed.
  if (signal.aborted) {
    throw signal.error;
  }

  // Do something else...
  await somethingElse();
});
```

Alternatively, locks can be acquired and released directly:

```ts
// Acquire a lock.
let lock = await redlock.acquire(["a"], 5000);
try {
  // Do something...
  await something();

  // Extend the lock. Note that this returns a new `Lock` instance.
  lock = await lock.extend(5000);

  // Do something else...
  await somethingElse();
} finally {
  // Release the lock.
  await lock.release();
}
```

### Use in CommonJS Projects

Beginning in version 5, this package is published primarily as an ECMAScript module. While this is universally accepted as the format of the future, there remain some interoperability quirks when used in CommonJS node applications. For major version 5, this package **also** distributes a copy transpiled to CommonJS. Please ensure that your project either uses either the ECMAScript or CommonJS version **but NOT both**.

The `Redlock` class is published as the "default" export, and can be imported with:

```ts
const { default: Redlock } = require("redlock");
```

In version 6, this package will stop distributing the CommonJS version.

## Error Handling

Because redlock is designed for high availability, it does not care if a minority of redis instances/clusters fail at an operation.

However, it can be helpful to monitor and log such cases. Redlock emits an "error" event whenever it encounters an error, even if the error is ignored in its normal operation.

```ts
redlock.on("error", (error) => {
  // Ignore cases where a resource is explicitly marked as locked on a client.
  if (error instanceof ResourceLockedError) {
    return;
  }

  // Log all other errors.
  console.error(error);
});
```

Additionally, a per-attempt and per-client stats (including errors) are made available on the `attempt` propert of both `Lock` and `ExecutionError` classes.

## API

Please view the (very concise) source code or TypeScript definitions for a detailed breakdown of the API.

## Guidance

### Contributing

Please see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for information on developing, running, and testing this library.

### High-Availability Recommendations

- Use at least 3 independent servers or clusters
- Use an odd number of independent redis **_servers_** for most installations
- Use an odd number of independent redis **_clusters_** for massive installations
- When possible, distribute redis nodes across different physical machines

### Using Cluster/Sentinel

**_Please make sure to use a client with built-in cluster support, such as [ioredis](https://github.com/luin/ioredis)._**

It is completely possible to use a _single_ redis cluster or sentinal configuration by passing one preconfigured client to redlock. While you do gain high availability and vastly increased throughput under this scheme, the failure modes are a bit different, and it becomes theoretically possible that a lock is acquired twice:

Assume you are using eventually-consistent redis replication, and you acquire a lock for a resource. Immediately after acquiring your lock, the redis master for that shard crashes. Redis does its thing and fails over to the slave which hasn't yet synced your lock. If another process attempts to acquire a lock for the same resource, it will succeed!

This is why redlock allows you to specify multiple independent nodes/clusters: by requiring consensus between them, we can safely take out or fail-over a minority of nodes without invalidating active locks.

To learn more about the the algorithm, check out the [redis distlock page](http://redis.io/topics/distlock).

Also note that when acquiring a lock on multiple resources, commands are executed in a single call to redis. Redis clusters require that all keys exist in a command belong to the same node. **If you are using a redis cluster or clusters and need to lock multiple resources together you MUST use [redis hash tags](https://redis.io/topics/cluster-spec#keys-hash-tags) (ie. use `ignored{considered}ignored{ignored}` notation in resource strings) to ensure that all keys resolve to the same node.** Chosing what data to include must be done thoughtfully, because representing the same conceptual resource in more than one way defeats the purpose of acquiring a lock. Accordingly, it's generally wise to use a single very generic prefix to ensure that ALL lock keys resolve to the same node, such as `{redlock}my_resource`. This is the most straightforward strategy and may be appropriate when the cluster has additional purposes. However, when locks will always naturally share a common attribute (for example, an organization/tenant ID), this may be used for better key distribution and cluster utilization. You can also acheive ideal utilization by completely omiting a hash tag if you do _not_ need to lock multiple resources at the same time.

### How do I check if something is locked?

The purpose of redlock is to provide exclusivity guarantees on a resource over a duration of time, and is not designed to report the ownership status of a resource. For example, if you are on the smaller side of a network partition you will fail to acquire a lock, but you don't know if the lock exists on the other side; all you know is that you can't guarantee exclusivity on yours. This is further complicated by retry behavior, and even moreso when acquiring a lock on more than one resource.

That said, for many tasks it's sufficient to attempt a lock with `retryCount=0`, and treat a failure as the resource being "locked" or (more correctly) "unavailable".

Note that with `retryCount=-1` there will be unlimited retries until the lock is aquired.

 */