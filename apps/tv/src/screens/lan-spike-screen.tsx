import { PlayroomText } from '@huddle/ui/native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LAN_PORT, lanServer } from '../platform/lan-server/native';

type Stats = {
  readonly status: string;
  readonly addresses: readonly string[];
  readonly open: number;
  readonly messages: number;
  readonly lastError?: string;
  readonly advertised?: string;
  readonly port?: number;
};

const SPIKE_CODE = Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');

/**
 * Diagnostic screen from the LAN spikes, kept until the room host runs in the
 * TV app (TASK-12): it hosts the server, advertises a random code, and answers
 * every ping from JavaScript, so a phone measures the path the host will use.
 */
export default function LanSpikeScreen() {
  const [stats, setStats] = useState<Stats>({ status: 'starting', addresses: [], open: 0, messages: 0 });

  useEffect(() => {
    const subscriptions = [
      lanServer.addListener('onOpen', () => setStats((s) => ({ ...s, open: s.open + 1 }))),
      lanServer.addListener('onClose', () => setStats((s) => ({ ...s, open: Math.max(0, s.open - 1) }))),
      lanServer.addListener('onError', ({ message }) => setStats((s) => ({ ...s, lastError: message }))),
      lanServer.addListener('onMessage', ({ id, data }) => {
        lanServer.send(id, data.replace('"t":"ping"', '"t":"pong"'));
        setStats((s) => ({ ...s, messages: s.messages + 1 }));
      }),
    ];
    lanServer
      .start(LAN_PORT)
      .then((port) => {
        setStats((s) => ({ ...s, status: 'listening', addresses: lanServer.addresses(), port }));
        return lanServer.advertise(SPIKE_CODE, port);
      })
      .then((name) => setStats((s) => ({ ...s, advertised: name })))
      .catch((error: unknown) => setStats((s) => ({ ...s, status: 'failed', lastError: String(error) })));
    return () => {
      for (const subscription of subscriptions) subscription.remove();
      lanServer.stopAdvertising();
      void lanServer.stop();
    };
  }, []);

  const address = stats.addresses[0] ?? 'no address';
  return (
    <View style={styles.stage}>
      <PlayroomText style={styles.title}>LAN server spike: {stats.status}</PlayroomText>
      <PlayroomText style={styles.line}>Addresses: {stats.addresses.join(', ') || '—'}</PlayroomText>
      <PlayroomText style={styles.line}>
        Phone link: huddle://lan-spike?url=ws://{address}:{stats.port ?? LAN_PORT}
      </PlayroomText>
      <PlayroomText style={styles.line}>Advertised as: {stats.advertised ?? '—'} (code {SPIKE_CODE})</PlayroomText>
      <PlayroomText style={styles.line}>Open connections: {stats.open}</PlayroomText>
      <PlayroomText style={styles.line}>Messages answered: {stats.messages}</PlayroomText>
      {stats.lastError === undefined ? null : (
        <PlayroomText style={styles.line}>Last error: {stats.lastError}</PlayroomText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, padding: 96, gap: 24, backgroundColor: '#F9F1E6' },
  title: { fontSize: 48, fontWeight: '900' },
  line: { fontSize: 32 },
});
