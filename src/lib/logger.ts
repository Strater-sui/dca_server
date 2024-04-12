import pino from 'pino';
import pretty from 'pino-pretty';

export const logger = pino(
  {
    level: 'info',
  },
  pino.multistream([
    {
      stream: pino.destination({
        dest: `./app.log`,
        sync: true
      }),
    },
    {
      stream: pretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      }),
    },
  ]));