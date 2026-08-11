import { useState } from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { colors } from '../colors';

import { HuddleLogo } from './logo';
import {
  BottomSheetOptionRow,
  CategoryListRow,
  IconGallery,
  InfoChip,
  JoinCountRow,
  ModeCard,
  NavigationIconButton,
  OnlineDot,
  PageDots,
  PhoneBrowsingHelper,
  PrimaryButton,
  QuestionStepper,
  RoomCode,
  SecondaryButton,
  SectionDivider,
  SegmentedControl,
  SelectableCard,
  SelectedBadge,
  StatusPill,
  StatusStrip,
} from './components';
import { huddleUIKitColors, huddleUIKitTypography } from './theme';

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: huddleUIKitColors.surface,
        borderWidth: 1,
        borderColor: huddleUIKitColors.border,
        borderRadius: 16,
        padding: 20,
        gap: 20,
      }}
    >
      <Text
        style={{
          color: huddleUIKitColors.textPrimary,
          fontFamily: huddleUIKitTypography.bold,
          fontSize: 20,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Development preview for the complete attached Huddle UI kit. */
export function HuddleUIKitDemo() {
  const [mode, setMode] = useState<'quick' | 'standard' | 'custom'>('custom');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Mixed'>('Hard');
  const [questions, setQuestions] = useState(15);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <HuddleLogo />

        <Section title="Navigation icons">
          <View style={{ flexDirection: 'row', gap: 18, flexWrap: 'wrap' }}>
            <NavigationIconButton icon="back" />
            <NavigationIconButton icon="carousel-left" />
            <NavigationIconButton icon="carousel-right" />
            <NavigationIconButton icon="chevron-right" />
            <NavigationIconButton icon="close" />
          </View>
        </Section>

        <Section title="Mode icons">
          <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
            {(['quick', 'standard', 'custom'] as const).map((candidate) => (
              <ModeCard
                key={candidate}
                mode={candidate}
                selected={mode === candidate}
                onPress={() => setMode(candidate)}
              />
            ))}
          </View>
        </Section>

        <Section title="Utility icons">
          <IconGallery />
        </Section>

        <Section title="Status + badge assets">
          <View style={{ flexDirection: 'row', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <SelectedBadge />
            <OnlineDot size={14} />
            <StatusPill variant="active" />
            <StatusPill variant="host" />
            <StatusPill variant="away" />
          </View>
          <StatusStrip>Players can keep joining until you start.</StatusStrip>
          <StatusStrip variant="success">Connected. Ready to play.</StatusStrip>
        </Section>

        <Section title="Reusable components">
          <Text style={{ color: huddleUIKitColors.textSecondary }}>Room code tiles</Text>
          <RoomCode code="HUDDLE" />
          <PageDots count={5} activeIndex={2} />
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <InfoChip icon="players" label="2–10 players" />
            <InfoChip icon="clock" label="15 min" />
            <InfoChip icon="category" label="Quiz" />
          </View>
          <SegmentedControl
            options={['Easy', 'Medium', 'Hard', 'Mixed'] as const}
            value={difficulty}
            onChange={setDifficulty}
          />
          <QuestionStepper value={questions} onChange={setQuestions} min={5} max={50} step={5} />
          <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
            <CategoryListRow label="Movies" />
            <BottomSheetOptionRow label="Sports" />
            <PrimaryButton label="Start Trivia" />
            <SecondaryButton label="Browse Games" />
            <SelectableCard icon="quick" label="Custom" selected />
          </View>
        </Section>

        <Section title="TV helper assets">
          <PhoneBrowsingHelper name="Sam" />
          <JoinCountRow joined={6} total={10} hostName="Sam" />
          <SectionDivider label="Players in the room" />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
