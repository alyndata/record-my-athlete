import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { useStore } from '../../src/store/StoreContext';
import { colors, font, radius, spacing } from '../../src/theme';
import { todayIso } from '../../src/util/format';

export default function NewGameScreen() {
  const router = useRouter();
  const { data, addAthlete, addGame } = useStore();

  const [athleteId, setAthleteId] = useState<string | null>(data.athletes[0]?.id ?? null);
  const [newAthleteName, setNewAthleteName] = useState('');
  const [opponent, setOpponent] = useState('');
  const [teamName, setTeamName] = useState('');
  const [date, setDate] = useState(todayIso());
  const [location, setLocation] = useState('');

  const onCreate = () => {
    let resolvedAthleteId = athleteId;

    if (!resolvedAthleteId) {
      const trimmed = newAthleteName.trim();
      if (!trimmed) {
        Alert.alert('Pick an athlete', 'Choose an athlete or enter a name to create one.');
        return;
      }
      resolvedAthleteId = addAthlete({ name: trimmed }).id;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Check the date', 'Use the format YYYY-MM-DD.');
      return;
    }

    const game = addGame({
      athleteId: resolvedAthleteId,
      opponent: opponent.trim() || undefined,
      teamName: teamName.trim() || undefined,
      date,
      location: location.trim() || undefined,
    });
    router.replace(`/games/${game.id}`);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={{ gap: spacing.md }}>
          <Text style={styles.label}>Athlete</Text>
          {data.athletes.length > 0 ? (
            <View style={styles.chips}>
              {data.athletes.map((a) => {
                const selected = a.id === athleteId;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => setAthleteId(a.id)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {a.name}
                      {a.jersey ? ` #${a.jersey}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setAthleteId(null)}
                style={[styles.chip, athleteId === null && styles.chipSelected]}
              >
                <Text style={[styles.chipText, athleteId === null && styles.chipTextSelected]}>
                  + New
                </Text>
              </Pressable>
            </View>
          ) : null}
          {athleteId === null ? (
            <TextInput
              style={styles.input}
              placeholder="New athlete name"
              placeholderTextColor={colors.subtle}
              value={newAthleteName}
              onChangeText={setNewAthleteName}
            />
          ) : null}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Text style={styles.label}>Game details</Text>
          <TextInput
            style={styles.input}
            placeholder="Date (YYYY-MM-DD)"
            placeholderTextColor={colors.subtle}
            value={date}
            onChangeText={setDate}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Opponent (optional)"
            placeholderTextColor={colors.subtle}
            value={opponent}
            onChangeText={setOpponent}
          />
          <TextInput
            style={styles.input}
            placeholder="Team name (optional)"
            placeholderTextColor={colors.subtle}
            value={teamName}
            onChangeText={setTeamName}
          />
          <TextInput
            style={styles.input}
            placeholder="Location (optional)"
            placeholderTextColor={colors.subtle}
            value={location}
            onChangeText={setLocation}
          />
        </Card>

        <Button title="Create Game" onPress={onCreate} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  label: { fontSize: font.h3, fontWeight: '700', color: colors.text },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.body,
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextSelected: { color: colors.white },
});
