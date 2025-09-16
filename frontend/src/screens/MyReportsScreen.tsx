// src/screens/MyReportsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { CONFIG } from '../../config';

// Types for our data (keep the same as before)
interface User {
  _id: string;
  name: string;
  email: string;
}

interface Department {
  _id: string;
  name: string;
}

interface StatusHistory {
  status: string;
  timestamp: Date;
  by: string;
  comment: string;
}

interface Comment {
  by: User;
  text: string;
  timestamp: Date;
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
  statusHistory: StatusHistory[];
  comments: Comment[];
  departmentId: Department;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalReports: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface Filters {
  status?: string;
  category?: string;
  userId?: string;
}

interface ApiResponse {
  reports: Report[];
  pagination: Pagination;
  filters: Filters;
}

// Status colors mapping
const statusColors: Record<string, string> = {
  'Submitted': '#6C757D',
  'Acknowledged': '#17A2B8',
  'In Progress': '#FFC107',
  'Resolved': '#28A745',
  'Closed': '#6C757D',
};

// Severity colors mapping
const severityColors: Record<string, string> = {
  'Low': '#28A745',
  'Medium': '#FFC107',
  'High': '#DC3545',
};

export default function MyReportsScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    category: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Get auth token from context
  const { authState } = useAuth();
  const token = authState?.token;

  // Available categories from your backend
  const categories = [
    'Water & Supply Management',
    'Electricity',
    'Public Health & Safety',
    'Fire & Emergency Services',
    'Sanitation & Waste Management',
    'Roads & Infrastructure',
    'Public Transportation',
    'Parks & Environment',
    'General Issues'
  ];

  // Available statuses
  const statuses = [
    'Submitted',
    'Acknowledged',
    'In Progress',
    'Resolved',
    'Closed'
  ];

  const fetchReports = async (page = 1, isRefreshing = false) => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      }
      setError(null);

      // Build query string from filters
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.category) queryParams.append('category', filters.category);
      queryParams.append('page', page.toString());
      queryParams.append('limit', '10');

      const response = await fetch(
        `${CONFIG.API_URL}/api/reports?${queryParams}`,
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

      const data: ApiResponse = await response.json();
      setReports(data.reports);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      Alert.alert('Error', 'Failed to load reports. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filters]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports(1, true);
  };

  const loadMore = () => {
    if (pagination?.hasNext && !loading) {
      fetchReports(pagination.currentPage + 1);
    }
  };

  const handleReportPress = (report: Report) => {
    setSelectedReport(report);
    setModalVisible(true);
  };

  const applyFilters = (newFilters: { status: string; category: string }) => {
    setFilters(newFilters);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilters({ status: '', category: '' });
    setShowFilters(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const renderReportItem = ({ item }: { item: Report }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => handleReportPress(item)}
    >
      {item.images.length > 0 && (
        <Image source={{ uri: item.images[0] }} style={styles.reportImage} />
      )}
      <View style={styles.reportContent}>
        <Text style={styles.reportTitle} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={styles.reportCategory}>{item.category}</Text>
        
        <View style={styles.metaContainer}>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
          <View style={[styles.severityBadge, { backgroundColor: severityColors[item.severity] }]}>
            <Text style={styles.severityText}>{item.severity}</Text>
          </View>
        </View>
        
        <Text style={styles.reportLocation} numberOfLines={1}>
          <Ionicons name="location" size={14} color="#6C757D" /> {item.location.address}
        </Text>
        <Text style={styles.reportDate}>{formatDate(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#2E86AB" />
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2E86AB" />
        <Text style={styles.loadingText}>Loading your reports...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={50} color="#DC3545" />
        <Text style={styles.errorText}>Error loading reports</Text>
        <Text style={styles.errorSubText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchReports()}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {reports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text" size={60} color="#6C757D" />
          <Text style={styles.emptyText}>No reports found</Text>
          <Text style={styles.emptySubText}>
            {filters.status || filters.category 
              ? 'Try changing your filters' 
              : 'You haven\'t submitted any reports yet'
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          renderItem={renderReportItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}

      {/* Floating Filter Button */}
      <TouchableOpacity 
        style={styles.floatingFilterButton}
        onPress={() => setShowFilters(true)}
      >
        <Ionicons name="filter" size={24} color="white" />
        {(filters.status || filters.category) && (
          <View style={styles.filterIndicator} />
        )}
      </TouchableOpacity>

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Reports</Text>
            
            <ScrollView>
              <Text style={styles.filterLabel}>Status</Text>
              <View style={styles.filterOptions}>
                {statuses.map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filterOption,
                      filters.status === status && styles.filterOptionSelected
                    ]}
                    onPress={() => setFilters(prev => ({
                      ...prev,
                      status: prev.status === status ? '' : status
                    }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.status === status && styles.filterOptionTextSelected
                    ]}>
                      {status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>Category</Text>
              <View style={styles.filterOptions}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.filterOption,
                      filters.category === category && styles.filterOptionSelected
                    ]}
                    onPress={() => setFilters(prev => ({
                      ...prev,
                      category: prev.category === category ? '' : category
                    }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      filters.category === category && styles.filterOptionTextSelected
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.clearButton]}
                onPress={clearFilters}
              >
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.applyButton]}
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        {selectedReport && (
          <View style={styles.detailContainer}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Report Details</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailContent}>
              {selectedReport.images.length > 0 && (
                <Image 
                  source={{ uri: selectedReport.images[0] }} 
                  style={styles.detailImage} 
                />
              )}
              
              <View style={styles.detailSection}>
                <Text style={styles.detailDescription}>{selectedReport.description}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Details</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Category:</Text>
                  <Text style={styles.detailValue}>{selectedReport.category}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColors[selectedReport.status] }]}>
                    <Text style={styles.statusText}>{selectedReport.status}</Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Severity:</Text>
                  <View style={[styles.severityBadge, { backgroundColor: severityColors[selectedReport.severity] }]}>
                    <Text style={styles.severityText}>{selectedReport.severity}</Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Location:</Text>
                  <Text style={styles.detailValue}>{selectedReport.location.address}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Department:</Text>
                  <Text style={styles.detailValue}>
                    {selectedReport.departmentId?.name || 'Not assigned'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Submitted:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedReport.createdAt)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last Updated:</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedReport.updatedAt)}</Text>
                </View>
              </View>

              {selectedReport.statusHistory && selectedReport.statusHistory.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Status History</Text>
                  {selectedReport.statusHistory.map((history, index) => (
                    <View key={index} style={styles.historyItem}>
                      <View style={styles.historyDot} />
                      <View style={styles.historyContent}>
                        <Text style={styles.historyStatus}>{history.status}</Text>
                        <Text style={styles.historyDate}>{formatDate(history.timestamp.toString())}</Text>
                        {history.comment && (
                          <Text style={styles.historyComment}>{history.comment}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {selectedReport.comments && selectedReport.comments.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Comments</Text>
                  {selectedReport.comments.map((comment, index) => (
                    <View key={index} style={styles.commentItem}>
                      <Text style={styles.commentAuthor}>{comment.by.name}:</Text>
                      <Text style={styles.commentText}>{comment.text}</Text>
                      <Text style={styles.commentDate}>{formatDate(comment.timestamp.toString())}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
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
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#6C757D',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC3545',
    marginTop: 10,
  },
  errorSubText: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2E86AB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  listContent: {
    padding: 10,
    paddingBottom: 80, // Extra padding to avoid overlap with floating button
  },
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
  metaContainer: {
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
  reportLocation: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 5,
  },
  reportDate: {
    fontSize: 12,
    color: '#6C757D',
  },
  footerLoader: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6C757D',
    marginTop: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    marginTop: 5,
  },
  // Floating Filter Button
  floatingFilterButton: {
    position: 'absolute',
    bottom: 10, // Position above the bottom navigation bar
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2E86AB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  filterIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC3545',
    borderWidth: 2,
    borderColor: '#2E86AB',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#343A40',
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  filterOption: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    marginRight: 10,
    marginBottom: 10,
  },
  filterOptionSelected: {
    backgroundColor: '#2E86AB',
    borderColor: '#2E86AB',
  },
  filterOptionText: {
    color: '#6C757D',
    fontSize: 12,
  },
  filterOptionTextSelected: {
    color: 'white',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  applyButton: {
    backgroundColor: '#2E86AB',
  },
  clearButtonText: {
    color: '#6C757D',
    fontWeight: '600',
  },
  applyButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  // Detail Modal styles
  detailContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#343A40',
  },
  closeButton: {
    padding: 5,
  },
  detailContent: {
    flex: 1,
  },
  detailImage: {
    width: '100%',
    height: 250,
  },
  detailSection: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#343A40',
    marginBottom: 15,
  },
  detailDescription: {
    fontSize: 16,
    color: '#343A40',
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6C757D',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#343A40',
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  historyItem: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  historyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2E86AB',
    marginRight: 10,
    marginTop: 5,
  },
  historyContent: {
    flex: 1,
  },
  historyStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#343A40',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 5,
  },
  historyComment: {
    fontSize: 14,
    color: '#343A40',
    fontStyle: 'italic',
  },
  commentItem: {
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E86AB',
    marginBottom: 5,
  },
  commentText: {
    fontSize: 14,
    color: '#343A40',
    marginBottom: 5,
  },
  commentDate: {
    fontSize: 12,
    color: '#6C757D',
  },
});