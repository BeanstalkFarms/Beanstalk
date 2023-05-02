const DEBUG = import.meta.env.VITE_DEBUG;

class Logger {
  static debugConfig: Record<string, boolean> = {
    DEFAULT: false
  };
  static modules = new Map<string, Logger>();
  name: string;

  constructor(name?: string) {
    this.name = name ?? "";
    const savedConfig = localStorage.getItem("debugConfig");
    if (savedConfig) Logger.debugConfig = JSON.parse(savedConfig);

    // @ts-ignore
    if (!globalThis.debug)
      // @ts-ignore
      globalThis.debug = (param?: string) => {
        if (param !== undefined) {
          if (typeof param === "boolean") {
            for (const [key, val] of Object.entries(Logger.debugConfig)) {
              Logger.debugConfig[key] = param;
            }
          } else {
            Logger.debugConfig[param] = !Logger.debugConfig[param];
          }
          localStorage.setItem("debugConfig", JSON.stringify(Logger.debugConfig));
        }
        this.log("%cDebug Config: ", "color: green");
        for (const [key, val] of Object.entries(Logger.debugConfig)) {
          this.log(`%c\t${key}: `, "color: green", val);
        }
      };
  }

  prefix() {
    return this.name ? `[${this.name.toLowerCase()}]: ` : "";
  }

  log(...args: any[]) {
    this.prefix() ? console.log(this.prefix(), ...args) : console.log(...args);
  }

  error(...args: any[]) {
    this.prefix() ? console.error(this.prefix(), ...args) : console.error(...args);
  }

  debug(...args: any[]) {
    const m = this.name || "DEFAULT";
    if (!!Logger.debugConfig[m]) {
      this.prefix() ? console.debug(this.prefix(), ...args) : console.debug(...args);
    }
  }

  module(name: string): Logger {
    const m = Logger.modules.has(name) ? Logger.modules.get(name) : new Logger(name);
    Logger.modules.set(name, m!);
    Logger.debugConfig[name] = Logger.debugConfig[name] ?? Logger.debugConfig.DEFAULT;

    return m!;
  }
}

export const Log = new Logger();
