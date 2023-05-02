const DEBUG = import.meta.env.VITE_DEBUG;

class Logger {
  static debugConfig: Record<string, boolean> = {
    DEFAULT: false
  };
  static modules = new Map<string, Logger>();
  name: string;

  constructor(name?: string) {
    this.name = name ?? "";

    if (DEBUG) {
      if (DEBUG === "1" || DEBUG === "0") {
        Logger.debugConfig.DEFAULT = !!parseInt(DEBUG);
      } else {
        try {
          DEBUG.split(",").map((module: string) => (Logger.debugConfig[module] = true));
        } catch (err: unknown) {
          this.error("VITE_DEBUG env variable parsing failed", (err as Error).message);
        }
      }
    }

    // @ts-ignore
    if (!globalThis.debug)
      // @ts-ignore
      globalThis.debug = (param?: string) => {
        if (param !== undefined) {
          if (typeof param === "boolean") {
            for (const [key, val] of Object.entries(Logger.debugConfig)) {
              console.log(key, val);
              Logger.debugConfig[key] = param;
            }
          } else {
            Logger.debugConfig[param] = !Logger.debugConfig[param];
          }
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
    Logger.debugConfig[name] = Logger.debugConfig.DEFAULT;

    return m!;
  }
}

export const Log = new Logger();
