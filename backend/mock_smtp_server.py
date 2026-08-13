import asyncio
import sys

class MockSMTPServer:
    def __init__(self, host='127.0.0.1', port=1025):
        self.host = host
        self.port = port

    async def handle_client(self, reader, writer):
        peer = writer.get_extra_info('peername')
        print(f"\n[Mock SMTP] Connection from {peer}")
        writer.write(b"220 localhost ZyloChat-Mock-SMTP Ready\r\n")
        await writer.drain()

        email_data = []
        in_data = False

        while True:
            try:
                line = await reader.readline()
                if not line:
                    break
                decoded_line = line.decode('utf-8', errors='ignore')
                
                if in_data:
                    if decoded_line.strip() == '.':
                        in_data = False
                        writer.write(b"250 OK: Message accepted for delivery\r\n")
                        await writer.drain()
                        
                        raw_email = "".join(email_data)
                        print("\n" + "="*60)
                        print("[Mock SMTP] RECEIVED EMAIL:")
                        print("="*60)
                        print(raw_email)
                        print("="*60 + "\n")
                        
                        # Flush console output
                        sys.stdout.flush()
                        email_data = []
                    else:
                        email_data.append(decoded_line)
                else:
                    cmd = decoded_line.strip()
                    cmd_upper = cmd.upper()
                    
                    if cmd_upper.startswith("EHLO") or cmd_upper.startswith("HELO"):
                        writer.write(b"250-localhost Hello\r\n250-SIZE 25000000\r\n250 HELP\r\n")
                        await writer.drain()
                    elif cmd_upper.startswith("MAIL FROM:"):
                        writer.write(b"250 2.1.0 Ok\r\n")
                        await writer.drain()
                    elif cmd_upper.startswith("RCPT TO:"):
                        writer.write(b"250 2.1.5 Ok\r\n")
                        await writer.drain()
                    elif cmd_upper == "DATA":
                        in_data = True
                        writer.write(b"354 Start mail input; end with <CR><LF>.<CR><LF>\r\n")
                        await writer.drain()
                    elif cmd_upper == "QUIT":
                        writer.write(b"221 2.0.0 Bye\r\n")
                        await writer.drain()
                        break
                    elif cmd_upper == "NOOP":
                        writer.write(b"250 OK\r\n")
                        await writer.drain()
                    else:
                        writer.write(b"250 OK\r\n")
                        await writer.drain()
            except Exception as e:
                print(f"[Mock SMTP Error] {e}")
                sys.stdout.flush()
                break

        writer.close()
        await writer.wait_closed()

    async def start(self):
        server = await asyncio.start_server(self.handle_client, self.host, self.port)
        addr = server.sockets[0].getsockname()
        print(f"[Mock SMTP] Server running on {addr[0]}:{addr[1]}")
        sys.stdout.flush()
        async with server:
            await server.serve_forever()

if __name__ == "__main__":
    try:
        asyncio.run(MockSMTPServer().start())
    except KeyboardInterrupt:
        print("[Mock SMTP] Server stopped.")
