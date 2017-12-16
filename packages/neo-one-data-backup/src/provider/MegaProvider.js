/* @flow */
import { File, Storage } from 'megajs';
import type { Log } from '@neo-one/utils';

import fs from 'fs';
import path from 'path';

import type { Environment } from '../types';
import Provider from './Provider';

import extract from './extract';
import upload from './upload';

export type Options = {|
  downloadID: string,
  key: string,
  writeBytesPerSecond: number,
  upload?: {|
    email: string,
    password: string,
    file: string,
  |},
|};

export default class MegaProvider extends Provider {
  _log: Log;
  _environment: Environment;
  _options: Options;

  constructor({
    log,
    environment,
    options,
  }: {|
    log: Log,
    environment: Environment,
    options: Options,
  |}) {
    super();
    this._log = log;
    this._environment = environment;
    this._options = options;
  }

  async restore(): Promise<void> {
    const { downloadID, key, writeBytesPerSecond } = this._options;
    const { dataPath, tmpPath } = this._environment;
    const downloadPath = path.resolve(tmpPath, 'storage.db.tar.gz');

    this._log({ event: 'DATA_BACKUP_MEGA_PROVIDER_RESTORE_DOWNLOAD' });
    try {
      await new Promise((resolve, reject) => {
        const read = new File({
          downloadID,
          key,
        }).download();
        const write = fs.createWriteStream(downloadPath);

        let done = false;
        const cleanup = () => {
          done = true;
        };

        const onDone = () => {
          if (!done) {
            cleanup();
            resolve();
          }
        };

        const onError = (error: Error) => {
          if (!done) {
            cleanup();
            reject(error);
          }
        };

        read.once('error', onError);
        write.once('error', onError);
        write.once('finish', onDone);

        read.pipe(write);
      });
      this._log({
        event: 'DATA_BACKUP_MEGA_PROVIDER_RESTORE_DOWNLOAD_SUCCESS',
      });
    } catch (error) {
      this._log({
        event: 'DATA_BACKUP_MEGA_PROVIDER_RESTORE_DOWNLOAD_ERROR',
        error,
      });
      throw error;
    }

    this._log({ event: 'DATA_BACKUP_MEGA_PROVIDER_RESTORE_EXTRACT' });
    try {
      await extract({
        downloadPath,
        dataPath,
        writeBytesPerSecond,
      });
      this._log({
        event: 'DATA_BACKUP_MEGA_PROVIDER_RESTORE_EXTRACT_SUCCESS',
      });
    } catch (error) {
      this._log({
        event: 'DATA_BACKUP_MEGA_PROVIDER_RESTORE_EXTRACT_ERROR',
        error,
      });
      throw error;
    }
  }

  async backup(): Promise<void> {
    const { upload: uploadOptions } = this._options;
    if (uploadOptions == null) {
      this._log({ event: 'DATA_BACKUP_MEGA_PROVIDER_SKIP_BACKUP' });
      return;
    }
    const { email, password, file } = uploadOptions;
    const { dataPath } = this._environment;

    this._log({ event: 'DATA_BACKUP_MEGA_PROVIDER_BACKUP' });
    try {
      await upload({
        dataPath,
        write: new Storage({
          email,
          password,
        }).upload(file),
      });
      this._log({ event: 'DATA_BACKUP_MEGA_PROVIDER_BACKUP_SUCCESS' });
    } catch (error) {
      this._log({ event: 'DATA_BACKUP_MEGA_PROVIDER_BACKUP_ERROR', error });
      throw error;
    }
  }
}
