import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../../constants/theme';

type EmptyStateProps = {
  title: string;
  body: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <View style={styles.emptyStateBox}>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyStateBox: {
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 16,
    paddingBottom: 6,
  },
  emptyStateTitle: {
    ...typography.cardTitle,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyStateBody: {
    ...typography.body,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
    textAlign: 'center',
  },
});
