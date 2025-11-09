import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator'; // ← optional, keep if you want real JPEG
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import Colors from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export default function ProductsManagement() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { authToken, isLoading: authLoading, isAuthenticated, validateToken, logout } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Additional images
  const [newAdditionalImages, setNewAdditionalImages] = useState([]);
  const [currentAdditionalImages, setCurrentAdditionalImages] = useState([]);
  const [deletedAdditionalImages, setDeletedAdditionalImages] = useState([]);

  // QR Modal
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [selectedProductForQr, setSelectedProductForQr] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const viewShotRef = useRef();

  const [formData, setFormData] = useState({
    name: '', description: '', price: '', category: '', unit: 'liter', unitSize: '', stock: '',
    milkType: 'Cow', image: null, discount: '', isFeatured: false, isAvailable: true,
    nutritionalInfo: { fat: '', protein: '', calories: '', carbohydrates: '' }, tags: '',
  });

  const [imageUri, setImageUri] = useState('');

  // ──────────────────────────────────────────────────────────────
  // AUTH & API HELPERS
  // ──────────────────────────────────────────────────────────────
  const handleApiError = (error, customMessage = null) => {
    console.error('API Error:', error);
    if (error.message?.includes('401') || error.response?.status === 401) {
      Alert.alert('Session Expired', 'Please login again.', [{ text: 'OK', onPress: () => logout() }]);
      return true;
    }
    Alert.alert('Error', customMessage || 'Something went wrong.');
    return false;
  };

  const validateAuthBeforeCall = async () => {
    if (!authToken || !isAuthenticated) return false;
    const isValid = await validateToken();
    if (!isValid) {
      Alert.alert('Session Expired', 'Please login again');
      return false;
    }
    return true;
  };

  const getAuthHeaders = (forFormData = false) => {
    const headers = { Authorization: `Bearer ${authToken}` };
    if (!forFormData) headers['Content-Type'] = 'application/json';
    return headers;
  };

  // ──────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && authToken && isAuthenticated) fetchData();
    else if (!authLoading && (!authToken || !isAuthenticated)) setLoading(false);
  }, [authToken, authLoading, isAuthenticated]);

  const fetchData = async () => {
    const ok = await validateAuthBeforeCall();
    if (!ok) return;

    try {
      setLoading(true);
      const [prodRes, catRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/catalog/products`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/api/catalog/categories`, { headers: getAuthHeaders() }),
      ]);

      if (!prodRes.ok) throw new Error('Failed to fetch products');
      const prodJson = await prodRes.json();
      const catJson = await catRes.json();

      setProducts(Array.isArray(prodJson.products) ? prodJson.products : prodJson || []);
      setCategories(Array.isArray(catJson.categories) ? catJson.categories : catJson || []);
    } catch (e) {
      handleApiError(e, 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.category?.name?.toLowerCase().includes(q) ||
      p.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  // ──────────────────────────────────────────────────────────────
  // FORM MODAL HANDLERS (unchanged – omitted for brevity)
  // ──────────────────────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingProduct(null);
    resetForm();
    setNewAdditionalImages([]);
    setCurrentAdditionalImages([]);
    setDeletedAdditionalImages([]);
    setModalVisible(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      category: product.category?._id || product.category || '',
      unit: product.unit || 'liter',
      unitSize: product.unitSize?.toString() || '',
      stock: product.stock?.toString() || '',
      milkType: product.milkType || 'Cow',
      image: null,
      discount: product.discount?.toString() || '0',
      isFeatured: product.isFeatured || false,
      isAvailable: product.isAvailable !== false,
      nutritionalInfo: product.nutritionalInfo || { fat: '', protein: '', calories: '', carbohydrates: '' },
      tags: Array.isArray(product.tags) ? product.tags.join(', ') : (typeof product.tags === 'string' ? product.tags : ''),
    });
    setImageUri(product.image || '');
    setNewAdditionalImages([]);
    setCurrentAdditionalImages(product.images || []);
    setDeletedAdditionalImages([]);
    setModalVisible(true);
  };

  const resetForm = () => {
    setFormData({
      name: '', description: '', price: '', category: '', unit: 'liter', unitSize: '', stock: '',
      milkType: 'Cow', image: null, discount: '', isFeatured: false, isAvailable: true,
      nutritionalInfo: { fat: '', protein: '', calories: '', carbohydrates: '' }, tags: '',
    });
    setImageUri('');
  };

  const closeModal = () => {
    setModalVisible(false);
    resetForm();
    setNewAdditionalImages([]);
    setCurrentAdditionalImages([]);
    setDeletedAdditionalImages([]);
    setEditingProduct(null);
  };

  // ──────────────────────────────────────────────────────────────
  // IMAGE PICKERS (unchanged)
  // ──────────────────────────────────────────────────────────────
  const pickImage = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return Alert.alert('Permission required', 'Camera roll access needed');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      const img = result.assets[0];
      setFormData(prev => ({
        ...prev,
        image: { uri: img.uri, type: 'image/jpeg', fileName: img.fileName || `img-${Date.now()}.jpg` },
      }));
      setImageUri(img.uri);
    }
  };

  const pickAdditionalImages = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return Alert.alert('Permission required', 'Camera roll access needed');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      const imgs = result.assets.map(a => ({
        uri: a.uri,
        type: 'image/jpeg',
        fileName: a.fileName || `add-${Date.now()}.jpg`,
      }));
      setNewAdditionalImages(p => [...p, ...imgs]);
    }
  };

  const handleRemoveImage = (item) => {
    if (item.isNew) {
      setNewAdditionalImages(p => p.filter(i => i.uri !== item.uri));
    } else {
      setCurrentAdditionalImages(p => p.filter(i => i._id !== item._id));
      setDeletedAdditionalImages(p => [...p, item._id]);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // PRODUCT SAVE / DELETE (unchanged – omitted for brevity)
  // ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => { /* ... same as before ... */ };
  const handleDelete = async (id) => { /* ... same as before ... */ };

  // ──────────────────────────────────────────────────────────────
  // QR MODAL
  // ──────────────────────────────────────────────────────────────
  const openQrModal = (product) => {
    setSelectedProductForQr(product);
    setQrLoading(false);
    setQrModalVisible(true);
  };

  const generateQr = async () => {
    if (!selectedProductForQr?._id) return;
    const ok = await validateAuthBeforeCall();
    if (!ok) return;

    try {
      setQrLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/catalog/products/generate/${selectedProductForQr._id}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (res.ok && data.qrCodeUrl) {
        setProducts(p => p.map(i => (i._id === selectedProductForQr._id ? { ...i, qrCodeUrl: data.qrCodeUrl } : i)));
        setSelectedProductForQr(prev => ({ ...prev, qrCodeUrl: data.qrCodeUrl }));
      } else {
        Alert.alert('Info', data.message || 'QR already exists.');
      }
    } catch (e) {
      handleApiError(e, 'Failed to generate QR.');
    } finally {
      setQrLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // NEW: SIMPLE QR DOWNLOAD (no FileSystem!)
  // ──────────────────────────────────────────────────────────────
  const downloadQr = async () => {
    if (!selectedProductForQr?.qrCodeUrl) return;

    try {
      // 1. Capture the rendered QR (PNG in cache)
      const capturedUri = await viewShotRef.current?.capture?.();
      if (!capturedUri) throw new Error('Capture failed');

      // 2. OPTIONAL: Convert to real JPEG (smaller file)
      let finalUri = capturedUri;
      try {
        const manip = await ImageManipulator.manipulateAsync(
          capturedUri,
          [],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        finalUri = manip.uri;
      } catch (e) {
        console.warn('JPEG conversion skipped', e);
      }

      // 3. Share – system handles saving to Photos, WhatsApp, etc.
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(finalUri, {
          mimeType: finalUri.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
          dialogTitle: 'Save QR Code',
          UTI: finalUri.endsWith('.jpg') ? 'public.jpeg' : 'public.png',
        });
      } else {
        Alert.alert('Saved', 'QR code is in your device cache.');
      }
    } catch (e) {
      console.error('QR download error:', e);
      Alert.alert('Error', 'Could not share QR code');
    }
  };

  // ──────────────────────────────────────────────────────────────
  // RENDER PRODUCT CARD (unchanged)
  // ──────────────────────────────────────────────────────────────
  const renderProduct = ({ item }) => {
    const out = item.stock <= 0;
    const disc = item.discount > 0 ? `${item.discount}% off` : null;

    return (
      <View style={styles.productCard}>
        <Image source={{ uri: item.image || 'https://via.placeholder.com/80' }} style={styles.productImage} resizeMode="cover" />
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.productCategory}>{item.category?.name || 'Uncategorized'}</Text>
          {item.description && <Text style={styles.productDescription} numberOfLines={2}>{item.description}</Text>}
          <View style={styles.priceRow}>
            <Text style={styles.productPrice}>₹{item.price}</Text>
            {disc && <Text style={styles.discountBadge}>{disc}</Text>}
          </View>
          <Text style={[styles.stockText, out && styles.outOfStockText]}>
            Stock: {item.stock} {item.unit}
          </Text>
        </View>
        <View style={styles.categoryActions}>
          <TouchableOpacity style={[styles.actionButton, styles.qrButton]} onPress={() => openQrModal(item)}>
            <Ionicons name="qr-code-outline" size={18} color={Colors.light.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={() => openEditModal(item)}>
            <Feather name="edit-2" size={18} color={Colors.light.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDelete(item._id)}>
            <Feather name="trash-2" size={18} color="#F44336" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const EmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="inventory-2" size={56} color={Colors.light.textSecondary} />
      <Text style={styles.emptyText}>{searchQuery ? 'No products found' : 'No products yet'}</Text>
      <Text style={styles.emptySubtext}>
        {searchQuery ? 'Try a different search term' : 'Add your first product to get started'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity style={styles.addFirstButton} onPress={openCreateModal}>
          <Text style={styles.addFirstButtonText}>Add Product</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (authLoading || loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // MAIN RETURN
  // ──────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top * 0.5 }]}>
      {/* SEARCH */}
      <View style={styles.searchFilterContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={Colors.light.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={Colors.light.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* LIST */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={i => i._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyList />}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* ─────── PRODUCT FORM MODAL (unchanged – omitted) ─────── */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal}>
        {/* ... same as before ... */}
      </Modal>

      {/* ─────── QR MODAL – NEW SIMPLE DOWNLOAD ─────── */}
      <Modal visible={qrModalVisible} transparent animationType="fade" onRequestClose={() => setQrModalVisible(false)}>
        <View style={styles.qrModalOverlay}>
          <View style={styles.qrModalContent}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Product QR Code</Text>
              <TouchableOpacity onPress={() => setQrModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={Colors.alloc} />
              </TouchableOpacity>
            </View>

            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={styles.qrContainer}>
              {selectedProductForQr?.qrCodeUrl ? (
                <Image source={{ uri: selectedProductForQr.qrCodeUrl }} style={styles.qrImage} resizeMode="contain" />
              ) : (
                <View style={styles.qrPlaceholder}>
                  {qrLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color={Colors.light.accent} />
                      <Text style={styles.loadingTextSmall}>Generating QR…</Text>
                    </View>
                  ) : (
                    <>
                      <Ionicons name="qr-code-outline" size={60} color={Colors.light.textSecondary} />
                      <Text style={styles.qrPlaceholderText}>QR not generated yet</Text>
                      <TouchableOpacity style={styles.generateQrButton} onPress={generateQr}>
                        <Ionicons name="sparkles" size={18} color="#FFF" />
                        <Text style={styles.generateQrButtonText}>Generate QR Code</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </ViewShot>

            {selectedProductForQr && <Text style={styles.qrProductName}>{selectedProductForQr.name}</Text>}

            {selectedProductForQr?.qrCodeUrl && (
              <TouchableOpacity style={styles.downloadQrButton} onPress={downloadQr}>
                <Ionicons name="download-outline" size={20} color="#FFF" />
                <Text style={styles.downloadQrButtonText}>Save QR (JPG/PNG)</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

//  == STYLES (unchanged) ===
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: Colors.light.textSecondary },
  loadingTextSmall: { marginTop: 12, fontSize: 14, color: Colors.light.textSecondary },

  searchFilterContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: Colors.light.text },

  listContent: { padding: 16, paddingBottom: 100 },
  productCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  productImage: { width: 64, height: 64, borderRadius: 12, marginRight: 12 },
  productInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '600', color: Colors.light.text, marginBottom: 2 },
  productCategory: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: 4 },
  productDescription: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  productPrice: { fontSize: 16, fontWeight: '700', color: Colors.light.accent },
  discountBadge: { fontSize: 12, color: '#4CAF50', fontWeight: '600', backgroundColor: '#E8F5E9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  stockText: { fontSize: 13, color: Colors.light.textSecondary },
  outOfStockText: { color: '#F44336', fontWeight: '600' },

  categoryActions: { flexDirection: 'row', gap: 8 },
  actionButton: { padding: 10, borderRadius: 12, backgroundColor: '#F5F5F5' },
  qrButton: { backgroundColor: '#E3F2FD' },
  editButton: { backgroundColor: '#E8F5E9' },
  deleteButton: { backgroundColor: '#FFEBEE' },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: Colors.light.accent,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', color: Colors.light.text, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: Colors.light.textSecondary, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
  addFirstButton: { backgroundColor: Colors.light.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 16 },
  addFirstButtonText: { color: '#FFF', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: Colors.light.border },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalBody: { padding: 20 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, gap: 12, borderTopWidth: 1, borderColor: Colors.light.border },
  cancelButton: { paddingHorizontal: 20, paddingVertical: 10 },
  cancelButtonText: { color: Colors.light.textSecondary, fontWeight: '600' },
  submitButton: { backgroundColor: Colors.light.accent, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 8 },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#FFF', fontWeight: '600' },

  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: Colors.light.text, marginBottom: 6 },
  subLabel: { fontSize: 13, fontWeight: '500', color: Colors.light.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFF',
  },
  inputSmall: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#FFF',
  },
  picker: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    backgroundColor: '#FFF',
    color: Colors.light.text,
  },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  nutriContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  nutriItem: { width: '48%', marginBottom: 12 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.light.text, marginBottom: 12 },
  pickButton: {
    backgroundColor: Colors.light.accent,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  pickButtonText: { color: '#FFF', fontWeight: '600' },
  preview: { width: 120, height: 120, borderRadius: 8, marginTop: 8 },
  previewSmall: { width: 80, height: 80, borderRadius: 8, marginRight: 12 },
  imageItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 8 },

  qrModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  qrModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '90%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
  },
  qrModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 20 },
  qrModalTitle: { fontSize: 20, fontWeight: '700', color: Colors.light.text },

  qrContainer: {
    padding: 20,
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    marginBottom: 16,
    alignItems: 'center',
    width: '100%',
  },
  qrImage: { width: 230, height: 230, borderRadius: 12 },
  qrPlaceholder: { alignItems: 'center', justifyContent: 'center', minHeight: 230, width: '100%' },
  loadingContainer: { alignItems: 'center' },

  qrPlaceholderText: { fontSize: 16, color: Colors.light.textSecondary, marginVertical: 16, textAlign: 'center' },

  generateQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  generateQrButtonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },

  qrProductName: { fontSize: 17, fontWeight: '600', color: Colors.light.text, textAlign: 'center', marginBottom: 16 },

  downloadQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  downloadQrButtonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
});