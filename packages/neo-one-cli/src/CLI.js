/* @flow */
// flowlint untyped-import:off
import { createServerConfig, plugins as pluginsUtil } from '@neo-one/server';
import { type CLIArgs, Client } from '@neo-one/server-common';
import Vorpal from 'vorpal';

import { map, take } from 'rxjs/operators';

import commands from './commands';
import pkg from '../package.json';
import { setupCLI } from './utils';

export default class CLI {
  _debug: boolean;
  _plugins: Set<string>;

  constructor({ debug }: {| debug: boolean |}) {
    this._debug = debug;
    this._plugins = new Set();
  }

  async start(argv: Array<string>): Promise<void> {
    const vorpal = new Vorpal();
    vorpal.version(pkg.version);

    const { log, config$: logConfig$, shutdownFuncs, shutdown } = setupCLI({
      logConsole: true,
      vorpal,
      debug: this._debug,
    });

    const cliArgs = {
      log,
      vorpal,
      debug: this._debug,
      binary: {
        cmd: argv[0],
        firstArg: argv[1],
      },
      shutdown,
      shutdownFuncs,
      logConfig$,
    };
    commands.forEach(command => command(cliArgs));

    const args = argv.slice(2).map((arg, idx) => {
      if (idx === 0) {
        return arg;
      }

      if (arg.includes(' ')) {
        return `"${arg}"`;
      }

      return arg;
    });

    const cmd = args.join(' ');
    let command = vorpal.find(cmd);
    if (command == null) {
      this._installDefaultPlugins(cliArgs);
      command = vorpal.find(cmd);
      if (command == null) {
        await this._installPlugins(cliArgs);
      }
    }

    vorpal.exec(cmd);
  }

  _installDefaultPlugins(cliArgs: CLIArgs): void {
    for (const plugin of pluginsUtil.DEFAULT_PLUGINS) {
      this._installPlugin(plugin, cliArgs);
    }
  }

  async _installPlugins(cliArgs: CLIArgs): Promise<void> {
    const serverConfig = createServerConfig({ log: () => {} });
    const port = await serverConfig.config$
      .pipe(map(conf => conf.server.port), take(1))
      .toPromise();
    const client = new Client({ port });
    const plugins = await client.getAllPlugins();
    for (const plugin of plugins) {
      this._installPlugin(plugin, cliArgs);
    }
  }

  _installPlugin(pluginName: string, cliArgs: CLIArgs): void {
    if (!this._plugins.has(pluginName)) {
      this._plugins.add(pluginName);
      const plugin = pluginsUtil.getPlugin({ log: cliArgs.log, pluginName });
      plugin.commands.forEach(command => command(cliArgs));
    }
  }
}
