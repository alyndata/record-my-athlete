import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { EmptyState } from '../../src/components/EmptyState';
import { useStore } from '../../src/store/StoreContext';
import { colors, font, radius, spacing } from '../../src/theme';

export default function AthletesScreen() {
  const { data, addAthlete, deleteAthlete } = useStore();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [jersey, setJersey] = useState('');

  const onAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Enter the athlete’s name.');
      return;
    }
    addAthlete({ name: trimmed, jersey: jersey.trim() || undefined });
    setName('');
    setJersey('');
  };

  const onDelete = (id: string, athleteName: string) => {
    Alert.alert(
      'Delete athlete?',
      `This removes ${athleteName} and all of their games, videos, and highlights.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteAthlete(id) },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={data.athletes}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        ListHeaderComponent={
          <Card style={styles.form}>
            <Text style={styles.formTitle}>Add an athlete</Text>
            <TextInput
              style={styles.input}
              placeholder="Name (e.g. Jordan)"
              placeholderTextColor={colors.subtle}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Jersey number (optional)"
              placeholderTextColor={colors.subtle}
              value={jersey}
              onChangeText={setJersey}
              keyboardType="number-pad"
            />
            <Button title="Add Athlete" onPress={onAdd} />
          </Card>
        }
        ListEmptyComponent={
          <EmptyState icon="🧒" title="No athletes yet" message="Add the kid you’re recording." />
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              {item.jersey ? <Text style={styles.jersey}>#{item.jersey}</Text> : null}
            </View>
            <Pressable onPress={() => onDelete(item.id, item.name)} hitSlop={8}>
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  form: { marginBottom: spacing.lg, gap: spacing.md },
  formTitle: { fontSize: font.h3, fontWeight: '700', color: colors.text },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  jersey: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  delete: { color: colors.danger, fontWeight: '700' },
});
