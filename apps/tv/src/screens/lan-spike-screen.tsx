import { PlayroomText } from '@huddle/ui/native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LAN_SPIKE_PORT, lanServer } from '../platform/lan-server/native';

type Stats = {
  readonly status: string;
  readonly addresses: readonly string[];
  readonly open: number;
  readonly messages: number;
  readonly lastError?: string;
};

/**
 * TASK-02 spike: hosts a WebSocket server and answers every ping from
 * JavaScript, so the phone measures the path the room host will use.
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
      .start(LAN_SPIKE_PORT)
      .then(() => setStats((s) => ({ ...s, status: 'listening', addresses: lanServer.addresses() })))
      .catch((error: unknown) => setStats((s) => ({ ...s, status: 'failed', lastError: String(error) })));
    return () => {
      for (const subscription of subscriptions) subscription.remove();
      void lanServer.stop();
    };
  }, []);

  const address = stats.addresses[0] ?? 'no address';
  return (
    <View style={styles.stage}>
      <PlayroomText style={styles.title}>LAN server spike: {stats.status}</PlayroomText>
      <PlayroomText style={styles.line}>Addresses: {stats.addresses.join(', ') || '—'}</PlayroomText>
      <PlayroomText style={styles.line}>
        Phone link: huddle://lan-spike?url=ws://{address}:{LAN_SPIKE_PORT}
      </PlayroomText>
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
