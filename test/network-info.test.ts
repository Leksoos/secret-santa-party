import assert from 'node:assert';
import type { AddressInfo } from 'node:net';
import express from 'express';
import os from 'os';

// Ensure NODE_ENV is set to test before importing server/index.js
process.env.NODE_ENV = 'test';

import {
  calculateInterfaceScore,
  getNetworkInfo,
  networkInfoHandler,
  type NetworkInfoResponse,
} from '../server/network.js';
import { app } from '../server/index.js';

console.log('🎄 ==================================================================');
console.log('🧪 Starting Network Info & LAN IP Auto-Detection Test Suite (R1)');
console.log('🎄 ==================================================================\n');

let totalTests = 0;
let passedTests = 0;

function pass(name: string, details?: string) {
  passedTests++;
  totalTests++;
  console.log(`  ✅ [PASS] ${name}${details ? ` — ${details}` : ''}`);
}

async function runTests() {
  // ----------------------------------------------------------------------------
  // Tier 1: Heuristic Interface & Subnet Priority Scoring Unit Tests
  // ----------------------------------------------------------------------------
  console.log('▶ [Tier 1] Verifying Interface & Subnet Priority Scoring Heuristics...');

  {
    // 1.1 Wi-Fi interface names (+100)
    assert.strictEqual(calculateInterfaceScore('en0', '8.8.8.8'), 100);
    assert.strictEqual(calculateInterfaceScore('wlan0', '8.8.8.8'), 100);
    assert.strictEqual(calculateInterfaceScore('wlo1', '8.8.8.8'), 100);
    assert.strictEqual(calculateInterfaceScore('wl_home', '8.8.8.8'), 100);
    assert.strictEqual(calculateInterfaceScore('Wi-Fi', '8.8.8.8'), 100);
    assert.strictEqual(calculateInterfaceScore('Wireless Network Adapter', '8.8.8.8'), 100);
    pass('1.1 Wi-Fi interface names correctly score +100 bonus');

    // 1.2 Secondary macOS interfaces (+70)
    assert.strictEqual(calculateInterfaceScore('en1', '8.8.8.8'), 70);
    assert.strictEqual(calculateInterfaceScore('en2', '8.8.8.8'), 70);
    assert.strictEqual(calculateInterfaceScore('en9', '8.8.8.8'), 70);
    pass('1.2 Secondary macOS en1..en9 interfaces correctly score +70');

    // 1.3 Physical Ethernet interfaces (+60)
    assert.strictEqual(calculateInterfaceScore('eth0', '8.8.8.8'), 60);
    assert.strictEqual(calculateInterfaceScore('eth1', '8.8.8.8'), 60);
    assert.strictEqual(calculateInterfaceScore('enp3s0', '8.8.8.8'), 60);
    assert.strictEqual(calculateInterfaceScore('ens33', '8.8.8.8'), 60);
    assert.strictEqual(calculateInterfaceScore('Ethernet adapter', '8.8.8.8'), 60);
    pass('1.3 Physical Ethernet interfaces correctly score +60');

    // 1.4 VPN adapter penalty (-50)
    assert.strictEqual(calculateInterfaceScore('utun0', '8.8.8.8'), -50);
    assert.strictEqual(calculateInterfaceScore('utun44', '8.8.8.8'), -50);
    assert.strictEqual(calculateInterfaceScore('tun0', '8.8.8.8'), -50);
    assert.strictEqual(calculateInterfaceScore('tap0', '8.8.8.8'), -50);
    assert.strictEqual(calculateInterfaceScore('tailscale0', '8.8.8.8'), -50);
    assert.strictEqual(calculateInterfaceScore('wg0', '8.8.8.8'), -50);
    assert.strictEqual(calculateInterfaceScore('ppp0', '8.8.8.8'), -50);
    pass('1.4 VPN interfaces (utun, tun, tap, tailscale, wg, ppp) penalized by -50');

    // 1.5 Container/virtual bridge penalty (-80)
    assert.strictEqual(calculateInterfaceScore('docker0', '8.8.8.8'), -80);
    assert.strictEqual(calculateInterfaceScore('veth1a2b', '8.8.8.8'), -80);
    assert.strictEqual(calculateInterfaceScore('br-c1d2e3', '8.8.8.8'), -80);
    assert.strictEqual(calculateInterfaceScore('vmnet1', '8.8.8.8'), -80);
    assert.strictEqual(calculateInterfaceScore('vboxnet0', '8.8.8.8'), -80);
    pass('1.5 Container and virtual bridges (docker, veth, br-, vmnet, vboxnet) penalized by -80');

    // 1.6 Subnet bonuses
    assert.strictEqual(calculateInterfaceScore('unknown0', '192.168.1.1'), 50);
    assert.strictEqual(calculateInterfaceScore('unknown0', '10.0.0.1'), 40);
    assert.strictEqual(calculateInterfaceScore('unknown0', '172.16.0.1'), 20);
    assert.strictEqual(calculateInterfaceScore('unknown0', '172.25.1.1'), 20);
    assert.strictEqual(calculateInterfaceScore('unknown0', '172.31.255.254'), 20);
    pass('1.6 Subnet scoring correctly awards +50 (192.168.x.x), +40 (10.x.x.x), +20 (172.16..31.x.x)');

    // 1.7 APIPA penalty (-100)
    assert.strictEqual(calculateInterfaceScore('unknown0', '169.254.1.1'), -100);
    assert.strictEqual(calculateInterfaceScore('en0', '169.254.10.20'), 0); // 100 - 100 = 0
    pass('1.7 APIPA link-local addresses (169.254.x.x) demoted by -100');

    // 1.8 Composite calculation checks
    assert.strictEqual(calculateInterfaceScore('en0', '192.168.1.82'), 150); // 100 + 50
    assert.strictEqual(calculateInterfaceScore('wlan0', '10.0.0.15'), 140);  // 100 + 40
    assert.strictEqual(calculateInterfaceScore('utun44', '172.22.12.13'), -30); // -50 + 20
    assert.strictEqual(calculateInterfaceScore('docker0', '172.17.0.1'), -60);  // -80 + 20
    pass('1.8 Composite scores: en0 on 192.168 is 150, wlan0 on 10.0 is 140, utun44 is -30');
  }

  // ----------------------------------------------------------------------------
  // Tier 2: getNetworkInfo with Mocked Interface Scenarios
  // ----------------------------------------------------------------------------
  console.log('\n▶ [Tier 2] Verifying Mocked Interface Detection Scenarios...');

  {
    // 2.1 macOS Wi-Fi vs VPN (reproducing live macOS machine)
    const mockMacIfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = {
      lo0: [
        { address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: true, cidr: '127.0.0.1/8' },
        { address: '::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:00', internal: true, cidr: '::1/128', scopeid: 0 },
      ],
      en0: [
        { address: 'fe80::105f:1962:bdc3:3fd5', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: 'a6:4c:a5:09:91:18', internal: false, cidr: 'fe80::/64', scopeid: 11 },
        { address: '192.168.1.82', netmask: '255.255.255.0', family: 'IPv4', mac: 'a6:4c:a5:09:91:18', internal: false, cidr: '192.168.1.82/24' },
      ],
      utun44: [
        { address: '172.22.12.13', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '172.22.12.13/24' },
      ],
    };

    const resMac = getNetworkInfo({ networkInterfaces: mockMacIfaces });
    assert.strictEqual(resMac.success, true);
    assert.strictEqual(resMac.ip, '192.168.1.82', 'en0 192.168.1.82 must beat utun44');
    assert.strictEqual(resMac.port, 5173);
    assert.strictEqual(resMac.serverPort, 3001);
    assert.strictEqual(resMac.url, 'http://192.168.1.82:5173');
    assert.strictEqual(resMac.tunnelUrl, null);
    assert.strictEqual(resMac.isOverridden, false);
    assert.strictEqual(resMac.interfaces.length, 2);
    assert.strictEqual(resMac.interfaces[0].name, 'en0');
    assert.strictEqual(resMac.interfaces[0].address, '192.168.1.82');
    assert.strictEqual(resMac.interfaces[0].score, 150);
    assert.strictEqual(resMac.interfaces[1].name, 'utun44');
    assert.strictEqual(resMac.interfaces[1].score, -30);
    pass('2.1 macOS Wi-Fi (en0) decisively beats VPN tunnel (utun44)');

    // 2.2 Linux Wi-Fi vs Docker vs Ethernet
    const mockLinuxIfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = {
      docker0: [
        { address: '172.17.0.1', netmask: '255.255.0.0', family: 'IPv4', mac: '02:42:1a:2b:3c:4d', internal: false, cidr: '172.17.0.1/16' },
      ],
      eth0: [
        { address: '192.168.1.10', netmask: '255.255.255.0', family: 'IPv4', mac: '52:54:00:12:34:56', internal: false, cidr: '192.168.1.10/24' }, // 60 + 50 = 110
      ],
      wlan0: [
        { address: '10.0.0.15', netmask: '255.255.255.0', family: 'IPv4', mac: '70:85:c2:aa:bb:cc', internal: false, cidr: '10.0.0.15/24' },     // 100 + 40 = 140
      ],
    };

    const resLinux = getNetworkInfo({ networkInterfaces: mockLinuxIfaces });
    assert.strictEqual(resLinux.ip, '10.0.0.15', 'wlan0 must beat eth0 and docker0');
    assert.strictEqual(resLinux.interfaces[0].name, 'wlan0');
    assert.strictEqual(resLinux.interfaces[1].name, 'eth0');
    assert.strictEqual(resLinux.interfaces[2].name, 'docker0');
    pass('2.2 Linux wlan0 (140) prioritizes over physical eth0 (110) and docker0 (-60)');

    // 2.3 APIPA Rejection
    const mockApipaIfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = {
      en0: [
        { address: '169.254.10.10', netmask: '255.255.0.0', family: 'IPv4', mac: 'a6:4c:a5:09:91:18', internal: false, cidr: '169.254.10.10/16' }, // 100 - 100 = 0
      ],
      en1: [
        { address: '192.168.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: 'a6:4c:a5:09:91:19', internal: false, cidr: '192.168.0.5/24' },    // 70 + 50 = 120
      ],
    };

    const resApipa = getNetworkInfo({ networkInterfaces: mockApipaIfaces });
    assert.strictEqual(resApipa.ip, '192.168.0.5', 'en1 on valid subnet must beat APIPA link-local on en0');
    assert.strictEqual(resApipa.interfaces[0].name, 'en1');
    assert.strictEqual(resApipa.interfaces[1].name, 'en0');
    pass('2.3 APIPA link-local 169.254.x.x demoted, healthy private subnet selected');

    // 2.4 IPv6 filtering
    const mockIpv6OnlyIfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = {
      en0: [
        { address: 'fe80::105f:1962:bdc3:3fd5', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: 'a6:4c:a5:09:91:18', internal: false, cidr: 'fe80::/64', scopeid: 11 },
        { address: '2a00:1370:817e:7344:5317:eafa:ae1c:e13d', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: 'a6:4c:a5:09:91:18', internal: false, cidr: '2a00::/64', scopeid: 0 },
      ],
      lo0: [
        { address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: true, cidr: '127.0.0.1/8' },
      ],
    };

    const resIpv6 = getNetworkInfo({ networkInterfaces: mockIpv6OnlyIfaces });
    assert.strictEqual(resIpv6.ip, '127.0.0.1', 'IPv6 interfaces must not be picked as IPv4 address');
    assert.strictEqual(resIpv6.interfaces.every((i) => i.family === 'IPv4'), true);
    pass('2.4 IPv6 interfaces strictly ignored, safe fallback to IPv4 loopback');

    // 2.5 Offline / Loopback fallback
    const mockOfflineIfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = {
      lo0: [
        { address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: true, cidr: '127.0.0.1/8' },
      ],
    };

    const resOffline = getNetworkInfo({ networkInterfaces: mockOfflineIfaces });
    assert.strictEqual(resOffline.ip, '127.0.0.1');
    assert.strictEqual(resOffline.url, 'http://127.0.0.1:5173');
    assert.strictEqual(resOffline.interfaces[0].name, 'lo0');
    assert.strictEqual(resOffline.isOverridden, false);
    pass('2.5 Complete offline state safely resolves to 127.0.0.1 loopback');
  }

  // ----------------------------------------------------------------------------
  // Tier 3: Overrides & Port Configuration Unit Tests
  // ----------------------------------------------------------------------------
  console.log('\n▶ [Tier 3] Verifying Overrides (HOST_IP, TUNNEL_URL, Ports)...');

  {
    // 3.1 HOST_IP via options
    const resHostIp = getNetworkInfo({ hostIp: '10.20.30.40' });
    assert.strictEqual(resHostIp.ip, '10.20.30.40');
    assert.strictEqual(resHostIp.url, 'http://10.20.30.40:5173');
    assert.strictEqual(resHostIp.isOverridden, true);
    assert(resHostIp.interfaces.some((i) => i.address === '10.20.30.40'), 'HOST_IP added to interfaces');
    pass('3.1 HOST_IP override via options sets ip, url, isOverridden: true');

    // 3.2 HOST_IP via process.env.HOST_IP
    const prevHostIp = process.env.HOST_IP;
    process.env.HOST_IP = '  192.168.10.99  ';
    try {
      const resEnvHost = getNetworkInfo();
      assert.strictEqual(resEnvHost.ip, '192.168.10.99');
      assert.strictEqual(resEnvHost.url, 'http://192.168.10.99:5173');
      assert.strictEqual(resEnvHost.isOverridden, true);
      pass('3.2 HOST_IP via environment variable trims whitespace and applies correctly');
    } finally {
      if (prevHostIp !== undefined) process.env.HOST_IP = prevHostIp;
      else delete process.env.HOST_IP;
    }

    // 3.3 TUNNEL_URL via options
    const resTunnel = getNetworkInfo({ tunnelUrl: 'https://santa-jackbox.ngrok.app///' });
    assert.strictEqual(resTunnel.tunnelUrl, 'https://santa-jackbox.ngrok.app', 'Trailing slashes normalized');
    assert.strictEqual(resTunnel.url, 'https://santa-jackbox.ngrok.app');
    assert.strictEqual(resTunnel.isOverridden, true);
    pass('3.3 TUNNEL_URL via options normalizes trailing slashes and overrides url');

    // 3.4 TUNNEL_URL via process.env.TUNNEL_URL
    const prevTunnel = process.env.TUNNEL_URL;
    process.env.TUNNEL_URL = 'https://mysanta.loca.lt/';
    try {
      const resEnvTunnel = getNetworkInfo();
      assert.strictEqual(resEnvTunnel.tunnelUrl, 'https://mysanta.loca.lt');
      assert.strictEqual(resEnvTunnel.url, 'https://mysanta.loca.lt');
      assert.strictEqual(resEnvTunnel.isOverridden, true);
      pass('3.4 TUNNEL_URL via environment variable normalizes and overrides url');
    } finally {
      if (prevTunnel !== undefined) process.env.TUNNEL_URL = prevTunnel;
      else delete process.env.TUNNEL_URL;
    }

    // 3.5 Both HOST_IP and TUNNEL_URL active
    const resBoth = getNetworkInfo({
      hostIp: '192.168.1.50',
      tunnelUrl: 'https://santa-dual.tunnel.me',
    });
    assert.strictEqual(resBoth.ip, '192.168.1.50');
    assert.strictEqual(resBoth.tunnelUrl, 'https://santa-dual.tunnel.me');
    assert.strictEqual(resBoth.url, 'https://santa-dual.tunnel.me', 'tunnelUrl takes precedence in public url');
    assert.strictEqual(resBoth.isOverridden, true);
    pass('3.5 Both HOST_IP and TUNNEL_URL set preserves host IP while using tunnel URL');

    // 3.6 Custom Client Port and Server Port
    const resPorts = getNetworkInfo({ clientPort: 3000, serverPort: 8000 });
    assert.strictEqual(resPorts.port, 3000);
    assert.strictEqual(resPorts.serverPort, 8000);
    assert(resPorts.url.endsWith(':3000'));
    pass('3.6 Custom clientPort and serverPort applied correctly in response and url');
  }

  // ----------------------------------------------------------------------------
  // Tier 4: Ephemeral HTTP Server Integration Tests
  // ----------------------------------------------------------------------------
  console.log('\n▶ [Tier 4] Verifying HTTP API Integration via Ephemeral Server & Native fetch...');

  {
    // 4.1 Ephemeral server with server/index.ts app
    const ephemeralServer = app.listen(0);
    await new Promise<void>((resolve) => ephemeralServer.once('listening', resolve));
    const port = (ephemeralServer.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // 4.1 Basic GET /api/network-info
      const res = await fetch(`${baseUrl}/api/network-info`);
      assert.strictEqual(res.status, 200, 'HTTP status must be 200');
      assert(res.headers.get('content-type')?.includes('application/json'), 'Content-type must be JSON');

      const body: NetworkInfoResponse = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(typeof body.ip, 'string');
      assert(/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(body.ip), 'ip must be valid IPv4');
      assert.strictEqual(body.port, 5173);
      assert.strictEqual(body.serverPort, 3001);
      assert.strictEqual(body.url, `http://${body.ip}:5173`);
      assert.strictEqual(body.tunnelUrl, null);
      assert.strictEqual(body.isOverridden, false);
      assert(Array.isArray(body.interfaces));
      assert(body.interfaces.length > 0);
      for (const iface of body.interfaces) {
        assert.strictEqual(typeof iface.name, 'string');
        assert.strictEqual(typeof iface.address, 'string');
        assert.strictEqual(iface.family, 'IPv4');
      }
      pass('4.1 GET /api/network-info returns 200 OK with fully compliant NetworkInfoResponse schema');

      // 4.2 Query param port override: ?port=8080
      const resQueryPort = await fetch(`${baseUrl}/api/network-info?port=8080`);
      const bodyQueryPort: NetworkInfoResponse = await resQueryPort.json();
      assert.strictEqual(bodyQueryPort.port, 8080);
      assert.strictEqual(bodyQueryPort.url, `http://${bodyQueryPort.ip}:8080`);
      pass('4.2 Query param ?port=8080 sets port and updates URL accordingly');

      // 4.3 Invalid query param port: ?port=abc (graceful fallback)
      const resInvalidPort = await fetch(`${baseUrl}/api/network-info?port=invalid`);
      const bodyInvalidPort: NetworkInfoResponse = await resInvalidPort.json();
      assert.strictEqual(bodyInvalidPort.port, 5173);
      assert.strictEqual(bodyInvalidPort.url, `http://${bodyInvalidPort.ip}:5173`);
      pass('4.3 Invalid query param ?port=invalid safely defaults to port 5173');

      // 4.4 Negative query param port: ?port=-5
      const resNegativePort = await fetch(`${baseUrl}/api/network-info?port=-5`);
      const bodyNegativePort: NetworkInfoResponse = await resNegativePort.json();
      assert.strictEqual(bodyNegativePort.port, 5173);
      pass('4.4 Negative query param ?port=-5 safely defaults to port 5173');

      // 4.5 Dynamic environment variable override during HTTP request
      process.env.TUNNEL_URL = 'https://ephemeral-santa.tunnel.test';
      try {
        const resTunnelHttp = await fetch(`${baseUrl}/api/network-info`);
        const bodyTunnelHttp: NetworkInfoResponse = await resTunnelHttp.json();
        assert.strictEqual(bodyTunnelHttp.tunnelUrl, 'https://ephemeral-santa.tunnel.test');
        assert.strictEqual(bodyTunnelHttp.url, 'https://ephemeral-santa.tunnel.test');
        assert.strictEqual(bodyTunnelHttp.isOverridden, true);
        pass('4.5 TUNNEL_URL environment override reflected dynamically in HTTP API');
      } finally {
        delete process.env.TUNNEL_URL;
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        ephemeralServer.close((err) => (err ? reject(err) : resolve()));
      });
    }
  }

  // ----------------------------------------------------------------------------
  // Tier 5: Live Host Network Verification
  // ----------------------------------------------------------------------------
  console.log('\n▶ [Tier 5] Verifying Live Host Environment Detection...');

  {
    const liveInfo = getNetworkInfo();
    assert.strictEqual(liveInfo.success, true);
    assert.strictEqual(typeof liveInfo.ip, 'string');
    assert.notStrictEqual(liveInfo.ip, '127.0.0.1', 'Host machine has physical en0 interface, must not be loopback');
    assert(liveInfo.ip.startsWith('192.168.') || liveInfo.ip.startsWith('10.'), 'Host IP is valid LAN address');
    assert(liveInfo.interfaces.length >= 1);
    assert.strictEqual(liveInfo.interfaces[0].address, liveInfo.ip);
    pass(`5.1 Live system auto-detected primary LAN IP: ${liveInfo.ip} (interface: ${liveInfo.interfaces[0].name})`);
  }

  console.log('\n======================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} NETWORK INFO & AUTO-DETECTION TESTS PASSED CLEANLY!`);
  console.log('======================================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
