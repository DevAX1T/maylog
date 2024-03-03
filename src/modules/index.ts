import chalk, { Chalk } from 'chalk';
// Public: shows up in options (e.g. "disable module", via command OR dashboard)
// if public is false, CANNOT be disabled.


export type IModuleIndex = {
    /** Module name */
    name: string;
    /** If the module can be even referenced by anyone */
    public: boolean;
    /** If the module will be loaded if called on */
    enabled: boolean;
    /** The chalk load color for module references */
    color: Chalk;
}

export type MaylogModuleId = keyof typeof ModuleIndex;

const ModuleIndex = {
    'config'   : { name: 'Configuration', public: true,  enabled: true, color: chalk.white },
    'core'     : { name: 'Core',          public: false, enabled: true,  color: chalk.blue  },
    'info'     : { name: 'Information',   public: true,  enabled: true,  color: chalk.white },
    'command'  : { name: 'Command',       public: true,  enabled: true,  color: chalk.white },
    'employee' : { name: 'Employee',      public: true,  enabled: true,  color: chalk.white }
}

export { ModuleIndex };