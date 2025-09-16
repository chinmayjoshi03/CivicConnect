// src/screens/HomeScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { CONFIG } from '../../config';

// Types for API response
interface User {
  _id: string;
  name: string;
  email: string;
}

interface Report {
  _id: string;
  userId: User;
  description: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  images: string[];
  category: string;
  status: string;
  severity: string;
  createdAt: string;
  updatedAt: string;
  timeAgo: string;
  firstImage: string | null;
  imageCount: number;
  isOwnReport: boolean;
}

interface RecentReportsResponse {
  message: string;
  count: number;
  reports: Report[];
  maxRequested: number;
  hasMore: boolean;
}

// Announcements data (could be fetched from API in the future)
const announcements = [
  {
    id: '1',
    title: 'New Reporting Features',
    content: 'We\'ve added AI-powered image analysis to help categorize your reports automatically.',
    date: '2 days ago',
    type: 'update'
  },
  {
    id: '2',
    title: 'Maintenance Notice',
    content: 'Scheduled maintenance this weekend. The app may be unavailable for short periods.',
    date: '5 days ago',
    type: 'maintenance'
  },
  {
    id: '3',
    title: 'Welcome to Civic Connect',
    content: 'Thank you for helping make our community better by reporting issues.',
    date: '1 week ago',
    type: 'welcome'
  }
];

const announcementIcons = {
  update: 'megaphone',
  maintenance: 'construct',
  welcome: 'heart',
};

const announcementColors = {
  update: '#2E86AB',
  maintenance: '#FF9F1C',
  welcome: '#28A745',
};

export default function HomeScreen({ navigation }: any) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { authState } = useAuth();
  const token = authState?.token;

  const fetchRecentReports = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(
        `${CONFIG.API_URL}/api/reports/recent`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: RecentReportsResponse = await response.json();
      setReports(data.reports);
    } catch (err) {
      console.error('Failed to fetch recent reports:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchRecentReports();
    }
  }, [token]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecentReports(true);
  };

  const handleReportPress = (report: Report) => {
    Alert.alert(
      'Report Details',
      `Description: ${report.description}\nCategory: ${report.category}\nStatus: ${report.status}\nSeverity: ${report.severity}\nLocation: ${report.location.address}`,
      [{ text: 'OK' }]
    );
  };

  const handleAnnouncementPress = (announcement: any) => {
    Alert.alert(
      announcement.title,
      announcement.content,
      [{ text: 'OK' }]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Submitted':
        return '#6C757D';
      case 'Acknowledged':
        return '#17A2B8';
      case 'In Progress':
        return '#FF9F1C';
      case 'Resolved':
        return '#28A745';
      case 'Closed':
        return '#6C757D';
      default:
        return '#6C757D';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Low':
        return '#28A745';
      case 'Medium':
        return '#FFC107';
      case 'High':
        return '#DC3545';
      default:
        return '#6C757D';
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2E86AB" />
        <Text style={styles.loadingText}>Loading recent issues...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Announcements Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Announcements</Text>
          <Ionicons name="megaphone" size={20} color="#2E86AB" />
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.announcementsContainer}
        >
          {announcements.map((announcement) => (
            <TouchableOpacity
              key={announcement.id}
              style={styles.announcementCard}
              onPress={() => handleAnnouncementPress(announcement)}
            >
              <View style={[
                styles.announcementIcon,
                { backgroundColor: announcementColors[announcement.type as keyof typeof announcementColors] }
              ]}>
                <Ionicons 
                  name={announcementIcons[announcement.type as keyof typeof announcementIcons] as any} 
                  size={20} 
                  color="white" 
                />
              </View>
              <Text style={styles.announcementTitle} numberOfLines={1}>
                {announcement.title}
              </Text>
              <Text style={styles.announcementContent} numberOfLines={2}>
                {announcement.content}
              </Text>
              <Text style={styles.announcementDate}>{announcement.date}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recent Reports Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Reports</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MyReports')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={40} color="#DC3545" />
            <Text style={styles.errorText}>Failed to load reports</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => fetchRecentReports()}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text" size={40} color="#6C757D" />
            <Text style={styles.emptyText}>No recent reports</Text>
            <Text style={styles.emptySubText}>
              Submit your first report to see it here
            </Text>
          </View>
        ) : (
          reports.map((report) => (
            <TouchableOpacity
              key={report._id}
              style={styles.reportCard}
              onPress={() => handleReportPress(report)}
            >
              {report.firstImage && (
                <Image source={{ uri: report.firstImage }} style={styles.reportImage} />
              )}
              <View style={styles.reportContent}>
                <Text style={styles.reportTitle} numberOfLines={2}>
                  {report.description}
                </Text>
                <Text style={styles.reportCategory}>{report.category}</Text>
                
                <View style={styles.reportMeta}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) }]}>
                    <Text style={styles.statusText}>{report.status}</Text>
                  </View>
                  <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(report.severity) }]}>
                    <Text style={styles.severityText}>{report.severity}</Text>
                  </View>
                </View>
                
                <View style={styles.reportFooter}>
                  <Text style={styles.reportLocation} numberOfLines={1}>
                    <Ionicons name="location" size={12} color="#6C757D" /> {report.location.address}
                  </Text>
                  <Text style={styles.reportDate}>{report.timeAgo}</Text>
                </View>
                
                
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 10,
    color: '#6C757D',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#343A40',
  },
  seeAll: {
    color: '#2E86AB',
    fontWeight: '500',
  },
  // Announcements Styles
  announcementsContainer: {
    marginTop: 10,
  },
  announcementCard: {
    width: 280,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginRight: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  announcementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#343A40',
    marginBottom: 5,
  },
  announcementContent: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 8,
    lineHeight: 18,
  },
  announcementDate: {
    fontSize: 12,
    color: '#6C757D',
    fontStyle: 'italic',
  },
  // Reports Styles
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  reportImage: {
    width: '100%',
    height: 150,
  },
  reportContent: {
    padding: 15,
    position: 'relative',
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#343A40',
    marginBottom: 5,
  },
  reportCategory: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 10,
  },
  reportMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  severityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportLocation: {
    fontSize: 12,
    color: '#6C757D',
    flex: 1,
  },
  reportDate: {
    fontSize: 12,
    color: '#6C757D',
  },
  ownReportBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E86AB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ownReportText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
  },
  // Error and Empty States
  errorContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  errorText: {
    color: '#DC3545',
    marginTop: 10,
    marginBottom: 15,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2E86AB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  emptyText: {
    color: '#6C757D',
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 5,
  },
  emptySubText: {
    color: '#6C757D',
    fontSize: 14,
    textAlign: 'center',
  },
});