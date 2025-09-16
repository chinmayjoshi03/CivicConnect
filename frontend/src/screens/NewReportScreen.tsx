// src/screens/NewReportScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { CONFIG } from '../../config';

// Types
interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

interface AIDescription {
  description: string;
  category: string;
  severity: string;
  timestamp: string;
}

interface UploadResponse {
  imageUrl: string;
}

export default function NewReportScreen() {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('Medium');
  const [images, setImages] = useState<string[]>([]);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSeverityModal, setShowSeverityModal] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [descriptionHeight, setDescriptionHeight] = useState(120);
  const [manualAddress, setManualAddress] = useState('');

  const { authState } = useAuth();
  const token = authState?.token;

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

  const severities = ['Low', 'Medium', 'High'];

  useEffect(() => {
    (async () => {
      if (useCurrentLocation) {
        await getCurrentLocation();
      }
    })();
  }, [useCurrentLocation]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera roll permissions to upload images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        await uploadImage(imageUri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera permissions to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        await uploadImage(imageUri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      setLoading(true);
      
      const formData = new FormData();
      formData.append('image', {
        uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      } as any);

      const response = await fetch(`${CONFIG.API_URL}/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data: UploadResponse = await response.json();
      setImages(prev => [...prev, data.imageUrl]);
      
      // Automatically analyze the first image
      if (images.length === 0) {
        await analyzeImage(data.imageUrl);
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setLoading(false);
    }
  };

  const analyzeImage = async (imageUrl: string) => {
    try {
      setAiLoading(true);

      const response = await fetch(`${CONFIG.API_URL}/ai/describe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        throw new Error(`AI analysis failed: ${response.status}`);
      }

      const data: AIDescription = await response.json();
      
      // Pre-fill the form with AI suggestions
      setDescription(data.description);
      setCategory(data.category);
      setSeverity(data.severity);
      
      Alert.alert('AI Analysis Complete', 'Form has been pre-filled with AI suggestions. You can modify them as needed.');
    } catch (error) {
      console.error('AI analysis error:', error);
      Alert.alert('Error', 'Failed to analyze image. Please fill the form manually.');
    } finally {
      setAiLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant location permissions to use your current location');
        setUseCurrentLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      await reverseGeocode(latitude, longitude);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get current location');
      setUseCurrentLocation(false);
    } finally {
      setLocationLoading(false);
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`${CONFIG.API_URL}/location/reverse-geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ lat, lng }),
      });

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`);
      }

      const data = await response.json();
      setLocation({
        lat,
        lng,
        address: data.address,
      });
    } catch (error) {
      console.error('Geocoding error:', error);
      Alert.alert('Error', 'Failed to get address from coordinates');
    }
  };

  const handleManualAddressChange = (address: string) => {
    setManualAddress(address);
    if (address.trim() && !useCurrentLocation) {
      setLocation(prev => ({
        lat: prev?.lat || 0,
        lng: prev?.lng || 0,
        address: address.trim(),
      }));
    }
  };

  const submitReport = async () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please provide a description of the issue');
      return;
    }

    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    if (images.length === 0) {
      Alert.alert('Error', 'Please add at least one image');
      return;
    }

    if (!location?.address.trim()) {
      Alert.alert('Error', 'Please provide a location');
      return;
    }

    try {
      setLoading(true);

      const reportData = {
        description: description.trim(),
        location: {
          lat: location.lat,
          lng: location.lng,
          address: location.address.trim(),
        },
        images,
        category,
        severity,
      };

      const response = await fetch(`${CONFIG.API_URL}/api/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(reportData),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Report submitted successfully!', [
          { text: 'OK', onPress: () => resetForm() }
        ]);
      } else {
        throw new Error(data.message || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDescription('');
    setCategory('');
    setSeverity('Medium');
    setImages([]);
    setLocation(null);
    setManualAddress('');
    setUseCurrentLocation(true);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Report New Issue</Text>

        {/* Image Upload Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos *</Text>
          <Text style={styles.sectionSubtitle}>Add photos of the issue (required)</Text>
          
          <View style={styles.imageButtons}>
            <TouchableOpacity style={styles.imageButton} onPress={pickImage} disabled={loading}>
              <Ionicons name="image" size={24} color="#2E86AB" />
              <Text style={styles.imageButtonText}>Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.imageButton} onPress={takePhoto} disabled={loading}>
              <Ionicons name="camera" size={24} color="#2E86AB" />
              <Text style={styles.imageButtonText}>Camera</Text>
            </TouchableOpacity>
          </View>

          {images.length > 0 && (
            <View style={styles.imagePreviewContainer}>
              {images.map((image, index) => (
                <View key={index} style={styles.imagePreviewWrapper}>
                  <Image source={{ uri: image }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#DC3545" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {images.length > 0 && (
            <TouchableOpacity
              style={styles.aiAnalyzeButton}
              onPress={() => analyzeImage(images[0])}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={16} color="white" />
                  <Text style={styles.aiAnalyzeButtonText}>Analyze with AI</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Description Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description *</Text>
        <TextInput
            style={[styles.descriptionInput, { height: descriptionHeight }]}
            placeholder="Describe the issue in detail..."
            placeholderTextColor="#6C757D"
            value={description}
            onChangeText={setDescription}
            multiline
            onContentSizeChange={(e) => {
                setDescriptionHeight(Math.max(150, e.nativeEvent.contentSize.height));
            }}
            textAlignVertical="top"
        />
        </View>

        {/* Category Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowCategoryModal(true)}
          >
            <Text style={category ? styles.pickerButtonText : styles.pickerButtonPlaceholder}>
              {category || 'Select category'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#6C757D" />
          </TouchableOpacity>
        </View>

        {/* Severity Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Severity</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowSeverityModal(true)}
          >
            <Text style={styles.pickerButtonText}>{severity}</Text>
            <Ionicons name="chevron-down" size={20} color="#6C757D" />
          </TouchableOpacity>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location *</Text>
          
          <View style={styles.locationToggle}>
            <Text style={styles.locationToggleText}>Use current location</Text>
            <Switch
              value={useCurrentLocation}
              onValueChange={setUseCurrentLocation}
              trackColor={{ false: '#767577', true: '#2E86AB' }}
              thumbColor={useCurrentLocation ? '#f4f3f4' : '#f4f3f4'}
            />
          </View>

          {useCurrentLocation ? (
            <View style={styles.locationInfo}>
              {locationLoading ? (
                <ActivityIndicator size="small" color="#2E86AB" />
              ) : location ? (
                <>
                  <Ionicons name="location" size={16} color="#2E86AB" />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {location.address}
                  </Text>
                </>
              ) : (
                <Text style={styles.locationError}>Location not available</Text>
              )}
            </View>
          ) : (
            <TextInput
              style={styles.locationInput}
              placeholder="Enter address manually..."
              placeholderTextColor="#6C757D"
              value={manualAddress}
              onChangeText={handleManualAddressChange}
            />
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.submitButton}
          onPress={submitReport}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Report</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <ScrollView>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={styles.modalOption}
                  onPress={() => {
                    setCategory(cat);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{cat}</Text>
                  {category === cat && (
                    <Ionicons name="checkmark" size={20} color="#2E86AB" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCategoryModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Severity Modal */}
      <Modal
        visible={showSeverityModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSeverityModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Severity</Text>
            {severities.map((sev) => (
              <TouchableOpacity
                key={sev}
                style={styles.modalOption}
                onPress={() => {
                  setSeverity(sev);
                  setShowSeverityModal(false);
                }}
              >
                <Text style={styles.modalOptionText}>{sev}</Text>
                {severity === sev && (
                  <Ionicons name="checkmark" size={20} color="#2E86AB" />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowSeverityModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E86AB',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#343A40',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 10,
  },
  imageButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  imageButton: {
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    minWidth: 120,
  },
  imageButtonText: {
    marginTop: 5,
    color: '#2E86AB',
    fontWeight: '500',
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  imagePreviewWrapper: {
    position: 'relative',
    marginRight: 10,
    marginBottom: 10,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  aiAnalyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E86AB',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  aiAnalyzeButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#343A40',
  },
  pickerButtonPlaceholder: {
    fontSize: 16,
    color: '#6C757D',
  },
  locationToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationToggleText: {
    fontSize: 14,
    color: '#343A40',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#343A40',
  },
  locationError: {
    color: '#DC3545',
    fontSize: 14,
  },
  locationInput: {
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#2E86AB',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
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
    marginBottom: 15,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#343A40',
  },
  modalCloseButton: {
    marginTop: 15,
    padding: 15,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  modalCloseButtonText: {
    color: '#2E86AB',
    fontSize: 16,
    fontWeight: '600',
  },
});