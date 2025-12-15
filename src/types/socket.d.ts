import "http";
import type { Server as SocketIOServer } from "socket.io";

declare module "http" {
  interface Server {
    io?: SocketIOServer;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var io: SocketIOServer | undefined;
}


