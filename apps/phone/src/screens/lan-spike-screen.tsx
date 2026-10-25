import { PlayroomText } from '@huddle/ui/native';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const SAMPLES = 200;
const SOAK_INTERVAL_MS = 1000;

type Result = {
  readonly status: string;
  readonly done: number;
  readonly median?: number;
  readonly p95?: number;
  readonly max?: number;
  readonly lastSoakMs?: number;
  readonly lastSoakAt?: string;
  readonly closed?: string;
};

function percentile(sorted: readonly number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? Number.NaN;
}

/**
 * TASK-02 spike: connects to the TV's LAN server, measures 200 sequential
 * round trips, then pings once a second so a sleeping TV shows up as silence.
 */
export default function LanSpikeScreen() {
  const { url } = useLocalSearchParams<{ url?: string }>();
  const [result, setResult] = useState<Result>({ status: url === undefined ? 'no url' : 'connecting', done: 0 });

  useEffect(() => {
    if (url === undefined) return;
    const socket = new WebSocket(url);
    const rtts: number[] = [];
    let soak: ReturnType<typeof setInterval> | undefined;
    const ping = (n: number) => socket.send(JSON.stringify({ t: 'ping', n, sentAt: performance.now() }));

    socket.onopen = () => {
      setResult((r) => ({ ...r, status: 'measuring' }));
      ping(0);
    };
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as { t: string; n: number; sentAt: number };
      const rtt = performance.now() - message.sentAt;
      if (message.n < SAMPLES) {
        rtts.push(rtt);
        setResult((r) => ({ ...r, done: rtts.length }));
        if (rtts.length < SAMPLES) {
          ping(message.n + 1);
          return;
        }
        const sorted = [...rtts].sort((a, b) => a - b);
        const summary = {
          median: percentile(sorted, 0.5),
          p95: percentile(sorted, 0.95),
          max: sorted[sorted.length - 1] ?? Number.NaN,
        };
        console.log('LAN_SPIKE_RESULT', JSON.stringify({ url, samples: SAMPLES, ...summary }));
        setResult((r) => ({ ...r, status: 'soaking', ...summary }));
        let n = SAMPLES;
        soak = setInterval(() => ping(++n), SOAK_INTERVAL_MS);
        return;
      }
      console.log('LAN_SPIKE_SOAK', JSON.stringify({ n: message.n, rtt }));
      setResult((r) => ({ ...r, lastSoakMs: rtt, lastSoakAt: new Date().toLocaleTimeString() }));
    };
    socket.onerror = (event) => {
      const message = (event as { message?: string }).message ?? 'unknown';
      console.log('LAN_SPIKE_ERROR', message);
      setResult((r) => ({ ...r, status: `error: ${message}` }));
    };
    socket.onclose = (event) => {
      console.log('LAN_SPIKE_CLOSED', event.code, event.reason);
      setResult((r) => ({ ...r, closed: `${event.code} ${event.reason}` }));
    };
    return () => {
      if (soak !== undefined) clearInterval(soak);
      socket.close();
    };
  }, [url]);

  const ms = (value?: number) => (value === undefined ? '—' : `${value.toFixed(1)} ms`);
  return (
    <View style={styles.screen}>
      <PlayroomText style={styles.title}>LAN spike</PlayroomText>
      <PlayroomText>{url ?? 'no url'}</PlayroomText>
      <PlayroomText>Status: {result.status}</PlayroomText>
      <PlayroomText>Samples: {result.done} / {SAMPLES}</PlayroomText>
      <PlayroomText>Median: {ms(result.median)}</PlayroomText>
      <PlayroomText>p95: {ms(result.p95)}</PlayroomText>
      <PlayroomText>Max: {ms(result.max)}</PlayroomText>
      <PlayroomText>Last soak ping: {ms(result.lastSoakMs)} at {result.lastSoakAt ?? '—'}</PlayroomText>
      {result.closed === undefined ? null : <PlayroomText>Closed: {result.closed}</PlayroomText>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, paddingTop: 96, gap: 12, backgroundColor: '#F9F1E6' },
  title: { fontSize: 28, fontWeight: '900' },
});
