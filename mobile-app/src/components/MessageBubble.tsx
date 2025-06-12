import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
      <Text style={isUser ? styles.userText : styles.aiText}>{message.content}</Text>
      {message.role === 'ai' && message.sources && message.sources.length > 0 && (
        <View style={styles.sourcesContainer}>
          <Text style={styles.sourcesTitle}>Kaynaklar:</Text>
          {message.sources.map((source, index) => (
            <View key={index} style={styles.sourceItem}>
              <Text style={styles.sourceText}>
                • {source.source_document} (Sayfa: {source.page + 1})
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 18,
    marginVertical: 4,
    maxWidth: '80%',
  },
  userContainer: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
    marginRight: 10,
  },
  aiContainer: {
    backgroundColor: '#E5E5EA',
    alignSelf: 'flex-start',
    marginLeft: 10,
  },
  userText: {
    color: 'white',
    fontSize: 16,
  },
  aiText: {
    color: 'black',
    fontSize: 16,
  },
  sourcesContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#C7C7CC',
    paddingTop: 8,
  },
  sourcesTitle: {
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 4,
  },
  sourceItem: {
    marginBottom: 2,
  },
  sourceText: {
    color: '#333',
    fontStyle: 'italic',
  },
});

export default MessageBubble; 