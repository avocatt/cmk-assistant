import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  IconButton,
  Divider,
  Button,
  Menu,
  Card,
} from 'react-native-paper';
import { ChatSessionPreview } from '../types';
import {
  getChatSessionPreviews,
  deleteChatSession,
  clearAllChatSessions,
} from '../services/chatSessionsStorage';

interface ChatSidebarProps {
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onClose: () => void;
  refreshTrigger?: number;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  activeSessionId,
  onSessionSelect,
  onNewChat,
  onClose,
  refreshTrigger,
}) => {
  const [sessions, setSessions] = useState<ChatSessionPreview[]>([]);
  const [menuVisible, setMenuVisible] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadSessions();
  }, [refreshTrigger]);

  const loadSessions = async () => {
    const sessionPreviews = await getChatSessionPreviews();
    setSessions(sessionPreviews);
  };

  const handleDeleteSession = async (sessionId: string) => {
    Alert.alert(
      'Sohbeti Sil',
      'Bu sohbeti silmek istediğinize emin misiniz?',
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await deleteChatSession(sessionId);
            await loadSessions();
            setMenuVisible(prev => ({ ...prev, [sessionId]: false }));
            
            // If deleted session was active, create new one
            if (sessionId === activeSessionId) {
              onNewChat();
            }
          },
        },
      ]
    );
  };

  const handleClearAllSessions = async () => {
    Alert.alert(
      'Tüm Sohbetleri Sil',
      'Tüm sohbet geçmişini silmek istediğinize emin misiniz?',
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await clearAllChatSessions();
            setSessions([]);
            onNewChat();
          },
        },
      ]
    );
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return 'Bugün';
    } else if (days === 1) {
      return 'Dün';
    } else if (days < 7) {
      return `${days} gün önce`;
    } else {
      return date.toLocaleDateString('tr-TR');
    }
  };

  const toggleMenu = (sessionId: string) => {
    setMenuVisible(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Sohbetler</Text>
        <IconButton
          icon="close"
          size={24}
          onPress={onClose}
          iconColor="#666"
        />
      </View>

      {/* New Chat Button */}
      <View style={styles.newChatContainer}>
        <Button
          mode="contained"
          onPress={onNewChat}
          style={styles.newChatButton}
          contentStyle={styles.newChatButtonContent}
          labelStyle={styles.newChatButtonLabel}
        >
          + Yeni Sohbet
        </Button>
      </View>

      <Divider />

      {/* Sessions List */}
      <ScrollView style={styles.sessionsList} showsVerticalScrollIndicator={false}>
        {sessions.map((session) => (
          <Card
            key={session.id}
            style={[
              styles.sessionCard,
              activeSessionId === session.id && styles.activeSessionCard,
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                onSessionSelect(session.id);
                onClose();
              }}
              style={styles.sessionItem}
            >
              <View style={styles.sessionContent}>
                <Text
                  style={[
                    styles.sessionTitle,
                    activeSessionId === session.id && styles.activeSessionTitle,
                  ]}
                  numberOfLines={1}
                >
                  {session.title}
                </Text>
                <Text style={styles.sessionMeta}>
                  {formatDate(session.updatedAt)} • {session.messageCount} mesaj
                </Text>
              </View>
              
              <Menu
                visible={menuVisible[session.id] || false}
                onDismiss={() => setMenuVisible(prev => ({ ...prev, [session.id]: false }))}
                anchor={
                  <IconButton
                    icon="dots-vertical"
                    size={16}
                    onPress={() => toggleMenu(session.id)}
                    iconColor="#666"
                  />
                }
              >
                <Menu.Item
                  onPress={() => handleDeleteSession(session.id)}
                  title="Sil"
                  leadingIcon="delete"
                />
              </Menu>
            </TouchableOpacity>
          </Card>
        ))}

        {sessions.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Henüz hiç sohbet yok.{'\n'}Yeni bir sohbet başlatın!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      {sessions.length > 0 && (
        <View style={styles.footer}>
          <Divider />
          <Button
            mode="text"
            onPress={handleClearAllSessions}
            style={styles.clearAllButton}
            labelStyle={styles.clearAllButtonLabel}
          >
            Tüm Sohbetleri Temizle
          </Button>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  newChatContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  newChatButton: {
    backgroundColor: '#007AFF',
  },
  newChatButtonContent: {
    paddingVertical: 6,
  },
  newChatButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sessionsList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  sessionCard: {
    marginVertical: 4,
    elevation: 0,
    backgroundColor: '#F9FAFB',
  },
  activeSessionCard: {
    backgroundColor: '#EBF4FF',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sessionContent: {
    flex: 1,
    marginRight: 8,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  activeSessionTitle: {
    color: '#007AFF',
    fontWeight: '600',
  },
  sessionMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    paddingTop: 12,
  },
  clearAllButton: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  clearAllButtonLabel: {
    color: '#EF4444',
    fontSize: 13,
  },
});

export default ChatSidebar; 