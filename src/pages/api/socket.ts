import type { NextApiRequest } from "next";
import type { NextApiResponse } from "next";
import { Server as IOServer } from "socket.io";

export const config = {
  api: { bodyParser: false }
};

type NextApiResponseServerIO = NextApiResponse & {
  socket: NextApiResponse["socket"] & {
    server: NextApiResponse["socket"]["server"] & { io?: IOServer };
  };
};

export default function handler(_req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server, { path: "/api/socket" });
    res.socket.server.io = io;
    (globalThis as any).io = io;

    io.on("connection", (socket) => {
      socket.on("room:join", ({ code }: { code: string }) => {
        if (typeof code === "string" && code.length <= 16) socket.join(code);
      });
    });
  }

  res.end();
}


