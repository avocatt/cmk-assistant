import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Animated, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChatSidebar from './ChatSidebar';

interface ChatDrawerLayoutProps {
  children: React.ReactNode;
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  isDrawerOpen: boolean;
  onDrawerToggle: () => void;
  refreshTrigger?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(320, SCREEN_WIDTH * 0.8);

const ChatDrawerLayout: React.FC<ChatDrawerLayoutProps> = ({
  children,
  activeSessionId,
  onSessionSelect,
  onNewChat,
  isDrawerOpen,
  onDrawerToggle,
  refreshTrigger,
}) => {
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: isDrawerOpen ? 0 : -DRAWER_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: isDrawerOpen ? 0.5 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isDrawerOpen]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (isDrawerOpen && gestureState.dx < 0) {
          // Dragging left when drawer is open
          const newTranslateX = Math.max(-DRAWER_WIDTH, gestureState.dx);
          translateX.setValue(newTranslateX);
          overlayOpacity.setValue((newTranslateX + DRAWER_WIDTH) / DRAWER_WIDTH * 0.5);
        } else if (!isDrawerOpen && gestureState.dx > 0 && gestureState.moveX < 50) {
          // Dragging right from left edge when drawer is closed
          const newTranslateX = Math.min(0, -DRAWER_WIDTH + gestureState.dx);
          translateX.setValue(newTranslateX);
          overlayOpacity.setValue((newTranslateX + DRAWER_WIDTH) / DRAWER_WIDTH * 0.5);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const shouldOpen = gestureState.dx > 50 || (isDrawerOpen && gestureState.dx > -50);
        
        if (shouldOpen !== isDrawerOpen) {
          onDrawerToggle();
        } else {
          // Snap back to current state
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: isDrawerOpen ? 0 : -DRAWER_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(overlayOpacity, {
              toValue: isDrawerOpen ? 0.5 : 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const closeDrawer = () => {
    if (isDrawerOpen) {
      onDrawerToggle();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.container} {...panResponder.panHandlers}>
        {/* Main Content */}
        <View style={styles.mainContent}>
          {children}
        </View>

        {/* Overlay */}
        {isDrawerOpen && (
          <Animated.View
            style={[
              styles.overlay,
              {
                opacity: overlayOpacity,
              },
            ]}
          >
            <View style={styles.overlayTouchable} onTouchStart={closeDrawer} />
          </Animated.View>
        )}

        {/* Drawer */}
        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          <ChatSidebar
            activeSessionId={activeSessionId}
            onSessionSelect={onSessionSelect}
            onNewChat={onNewChat}
            onClose={closeDrawer}
            refreshTrigger={refreshTrigger}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  mainContent: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 1,
  },
  overlayTouchable: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#FFFFFF',
    zIndex: 2,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
});

export default ChatDrawerLayout; 