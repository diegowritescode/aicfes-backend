import { Injectable } from '@nestjs/common';
import { Response } from 'express';

type StreamClient = {
  res: Response;
  pingTimer?: NodeJS.Timeout;
};

@Injectable()
export class DashboardStreamService {
  private clients = new Map<string, Set<StreamClient>>();

  addClient(userId: string, res: Response) {
    const client: StreamClient = { res };
    const bucket = this.clients.get(userId) || new Set();
    bucket.add(client);
    this.clients.set(userId, bucket);

    client.pingTimer = setInterval(() => {
      this.send(res, 'ping', { t: Date.now() });
    }, 25000);

    res.on('close', () => {
      this.removeClient(userId, client);
    });

    return client;
  }

  removeClient(userId: string, client: StreamClient) {
    if (client.pingTimer) {
      clearInterval(client.pingTimer);
    }

    const bucket = this.clients.get(userId);
    if (!bucket) {
      return;
    }

    bucket.delete(client);
    if (bucket.size === 0) {
      this.clients.delete(userId);
    }
  }

  publish(userId: string, event: string, data: any) {
    const bucket = this.clients.get(userId);
    if (!bucket) {
      return;
    }

    for (const client of bucket) {
      this.send(client.res, event, data);
    }
  }

  private send(res: Response, event: string, data: any) {
    const payload = JSON.stringify(data ?? {});
    res.write(`event: ${event}\n`);
    res.write(`data: ${payload}\n\n`);
  }
}
