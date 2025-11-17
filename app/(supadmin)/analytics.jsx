// app/(tabs)/supadmin/catalog.jsx
// Combined Catalog screen: Categories header (instagram-like) + Products vertical feed
// - Add / Edit Category (all fields preserved)
// - Add / Edit Product (all fields preserved, additional images support)
// - FAB bottom-right to Add Product
// - Category "story" horizontal at top, last chip = Add Category
// NOTE: requires expo-image-picker, expo-image-manipulator, react-native-view-shot, expo-sharing
// and your project's Colors and useAuth context.

import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const API_BASE = `${process.env.EXPO_PUBLIC_API_URL || ''}/api`;
const CATALOG_BASE = `${process.env.EXPO_PUBLIC_API_URL || ''}/api/catalog`;

export default function CatalogScreen() {
  const insets = useSafeAreaInsets();
  const { authToken, isLoading: authLoading, isAuthenticated, validateToken, logout } = useAuth();

  // data
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  // ui states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // category modal
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', description: '', image: '', displayOrder: 0 });
  const [catSubmitting, setCatSubmitting] = useState(false);

  // product modal
  const [prodModalVisible, setProdModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodForm, setProdForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    unit: 'liter',
    unitSize: '',
    stock: '',
    milkType: 'Cow',
    image: null,
    discount: '',
    isFeatured: false,
    isAvailable: true,
    nutritionalInfo: { fat: '', protein: '', calories: '', carbohydrates: '' },
    tags: '',
    // additional images
    images: [],
  });
  const [prodUploading, setProdUploading] = useState(false);
  const [newAdditionalImages, setNewAdditionalImages] = useState([]);
  const [deletedAdditionalImages, setDeletedAdditionalImages] = useState([]);

  // helpers
  const viewShotRef = useRef();
  const [searchQuery, setSearchQuery] = useState('');

  // ------- Auth helpers -------
  const getAuthHeaders = (forForm = false) => {
    const h = { Authorization: `Bearer ${authToken}` };
    if (!forForm) h['Content-Type'] = 'application/json';
    return h;
  };

  const validateAuthBeforeCall = async () => {
    if (!authToken || !isAuthenticated) {
      Alert.alert('Session', 'Please log in again.');
      return false;
    }
    const ok = await validateToken();
    if (!ok) {
      Alert.alert('Session', 'Please log in again.');
      logout();
      return false;
    }
    return true;
  };

  // ------- Fetching -------
  const fetchCatalog = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    try {
      if (!authToken) {
        setCategories([]);
        setProducts([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const [cRes, pRes] = await Promise.all([
        fetch(`${CATALOG_BASE}/categories`, { headers: getAuthHeaders() }),
        fetch(`${CATALOG_BASE}/products`, { headers: getAuthHeaders() }),
      ]);
      if (!cRes.ok) throw new Error('Failed loading categories');
      if (!pRes.ok) throw new Error('Failed loading products');
      const cJson = await cRes.json();
      const pJson = await pRes.json();

      // Accept different shapes
      const cats = Array.isArray(cJson) ? cJson : cJson.categories || [];
      const prods = Array.isArray(pJson) ? pJson : pJson.products || [];

      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      console.error('fetchCatalog err', err);
      Alert.alert('Error', 'Failed to load catalog. Check console for details.');
      setCategories([]);
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authLoading && authToken && isAuthenticated) fetchCatalog();
    else if (!authLoading && (!authToken || !isAuthenticated)) setLoading(false);
  }, [authLoading, authToken, isAuthenticated, fetchCatalog]);

  const onRefresh = useCallback(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // ------- Filters -------
  const filteredProducts = useMemo(() => {
    let list = products;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags?.join?.(',')?.toLowerCase().includes(q) ||
        p.category?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, searchQuery]);

  // ------- Image picker helpers -------
  const pickImageUri = async (allowMultiple = false) => {
    try {
      const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission', 'Allow photo access to pick images.');
        return null;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: allowMultiple,
      });
      if (result.canceled) return null;
      if (allowMultiple && result.assets) return result.assets.map(a => a.uri);
      return result.assets?.[0]?.uri || result.uri;
    } catch (err) {
      console.error('pickImageUri', err);
      Alert.alert('Error', 'Could not pick image');
      return null;
    }
  };

  const pickSingleImageAndCompress = async () => {
    const uri = await pickImageUri(false);
    if (!uri) return null;
    try {
      const manip = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1200 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
      return manip.uri;
    } catch (e) {
      console.warn('compress fail, using original', e);
      return uri;
    }
  };

  // ------- Category CRUD -------
  const openCreateCategory = () => {
    setEditingCategory(null);
    setCatForm({ name: '', description: '', image: '', displayOrder: 0 });
    setCatModalVisible(true);
  };
  const openEditCategory = (cat) => {
    setEditingCategory(cat);
    setCatForm({
      name: cat.name || '',
      description: cat.description || '',
      image: cat.image || '',
      displayOrder: cat.displayOrder ?? 0,
    });
    setCatModalVisible(true);
  };
  const submitCategory = async () => {
    if (!catForm.name.trim()) return Alert.alert('Validation', 'Category name required');
    if (!(await validateAuthBeforeCall())) return;
    setCatSubmitting(true);
    try {
      const isLocalImage = catForm.image && (catForm.image.startsWith('file:') || catForm.image.startsWith('content:') || catForm.image.includes('ph://'));
      let res;
      if (isLocalImage) {
        const fd = new FormData();
        fd.append('name', catForm.name.trim());
        fd.append('description', catForm.description || '');
        fd.append('displayOrder', String(catForm.displayOrder || 0));
        const filename = catForm.image.split('/').pop();
        fd.append('image', { uri: catForm.image, name: filename, type: 'image/jpeg' });
        res = await fetch(`${CATALOG_BASE}/categories${editingCategory ? `/${editingCategory._id}` : ''}`, {
          method: editingCategory ? 'PUT' : 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
          body: fd,
        });
      } else {
        const payload = { name: catForm.name.trim(), description: catForm.description || '', displayOrder: catForm.displayOrder || 0 };
        if (catForm.image?.startsWith?.('http')) payload.image = catForm.image;
        res = await fetch(`${CATALOG_BASE}/categories${editingCategory ? `/${editingCategory._1d || editingCategory._id}` : ''}`, {
          method: editingCategory ? 'PUT' : 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Server error');
      }
      Alert.alert('Success', `Category ${editingCategory ? 'updated' : 'created'}`);
      setCatModalVisible(false);
      fetchCatalog();
    } catch (err) {
      console.error('submitCategory', err);
      Alert.alert('Error', 'Failed to save category');
    } finally {
      setCatSubmitting(false);
    }
  };

  const deleteCategory = async (id, name) => {
    if (!(await validateAuthBeforeCall())) return;
    Alert.alert('Delete', `Delete category "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const res = await fetch(`${CATALOG_BASE}/categories/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
            if (!res.ok) throw new Error('delete failed');
            Alert.alert('Deleted');
            fetchCatalog();
          } catch (err) {
            console.error('deleteCategory', err);
            Alert.alert('Error', 'Could not delete category');
          }
        }
      }
    ]);
  };

  // ------- Product CRUD -------
  const openCreateProduct = () => {
    setEditingProduct(null);
    setProdForm({
      name: '', description: '', price: '', category: categories?.[0]?._id || '', unit: 'liter', unitSize: '', stock: '', milkType: 'Cow',
      image: null, discount: '', isFeatured: false, isAvailable: true, nutritionalInfo: { fat: '', protein: '', calories: '', carbohydrates: '' }, tags: '', images: []
    });
    setNewAdditionalImages([]);
    setDeletedAdditionalImages([]);
    setProdModalVisible(true);
  };

  const openEditProduct = (p) => {
    setEditingProduct(p);
    setProdForm({
      name: p.name || '',
      description: p.description || '',
      price: p.price?.toString() || '',
      category: p.category?._id || p.category || '',
      unit: p.unit || 'liter',
      unitSize: p.unitSize?.toString() || '',
      stock: p.stock?.toString() || '',
      milkType: p.milkType || 'Cow',
      image: null, // we keep uri separate
      discount: p.discount?.toString() || '',
      isFeatured: p.isFeatured || false,
      isAvailable: p.isAvailable !== false,
      nutritionalInfo: p.nutritionalInfo || { fat: '', protein: '', calories: '', carbohydrates: '' },
      tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''),
      images: p.images || [],
    });
    setNewAdditionalImages([]);
    setDeletedAdditionalImages([]);
    setProdModalVisible(true);
  };

  const pickProductMainImage = async () => {
    const uri = await pickSingleImageAndCompress();
    if (uri) setProdForm(f => ({ ...f, image: { uri, fileName: uri.split('/').pop(), type: 'image/jpeg' } }));
  };
  const pickProductAdditional = async () => {
    const uris = await pickImageUri(true);
    if (!uris) return;
    const list = Array.isArray(uris) ? uris : [uris];
    setNewAdditionalImages(prev => [...prev, ...list.map(u => ({ uri: u, fileName: u.split('/').pop(), type: 'image/jpeg', isNew: true }))]);
  };
  const removeAdditionalImage = (img) => {
    if (img.isNew) setNewAdditionalImages(prev => prev.filter(i => i.uri !== img.uri));
    else {
      setProdForm(prev => ({ ...prev, images: prev.images.filter(i => i._id !== img._id) }));
      setDeletedAdditionalImages(prev => [...prev, img._id]);
    }
  };

  const submitProduct = async () => {
    if (!prodForm.name.trim() || !prodForm.price || !prodForm.category) return Alert.alert('Validation', 'Name, Price & Category required');
    if (!(await validateAuthBeforeCall())) return;
    setProdUploading(true);
    try {
      const fd = new FormData();
      fd.append('name', prodForm.name.trim());
      fd.append('description', prodForm.description || '');
      fd.append('price', parseFloat(prodForm.price || 0).toString());
      fd.append('category', prodForm.category);
      fd.append('unit', prodForm.unit || 'liter');
      fd.append('unitSize', String(parseInt(prodForm.unitSize || 0) || 0));
      fd.append('stock', String(parseInt(prodForm.stock || 0) || 0));
      fd.append('milkType', prodForm.milkType || 'Cow');
      fd.append('discount', String(parseFloat(prodForm.discount || 0) || 0));
      fd.append('isFeatured', String(Boolean(prodForm.isFeatured)));
      fd.append('isAvailable', String(Boolean(prodForm.isAvailable)));
      fd.append('tags', prodForm.tags || '');

      // nutrition
      Object.keys(prodForm.nutritionalInfo || {}).forEach(k => {
        fd.append(`nutritionalInfo[${k}]`, String(prodForm.nutritionalInfo[k] || 0));
      });

      // main image
      if (prodForm.image?.uri) {
        fd.append('image', { uri: prodForm.image.uri, name: prodForm.image.fileName || 'image.jpg', type: prodForm.image.type || 'image/jpeg' });
      } else if (prodForm.image && typeof prodForm.image === 'string' && prodForm.image.startsWith('http')) {
        fd.append('imageUrl', prodForm.image);
      }

      // new additional
      newAdditionalImages.forEach((img, idx) => {
        fd.append('additionalImages', { uri: img.uri, name: img.fileName || `add-${idx}.jpg`, type: img.type || 'image/jpeg' });
      });

      if (deletedAdditionalImages.length) fd.append('deletedImages', JSON.stringify(deletedAdditionalImages));

      const url = `${CATALOG_BASE}/products${editingProduct ? `/${editingProduct._id}` : ''}`;
      const res = await fetch(url, { method: editingProduct ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: fd });
      if (!res.ok) throw new Error('product save failed');
      Alert.alert('Success', `Product ${editingProduct ? 'updated' : 'created'}`);
      setProdModalVisible(false);
      fetchCatalog();
    } catch (err) {
      console.error('submitProduct', err);
      Alert.alert('Error', 'Failed to save product');
    } finally {
      setProdUploading(false);
    }
  };

  const deleteProduct = async (id) => {
    if (!(await validateAuthBeforeCall())) return;
    Alert.alert('Delete Product', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const res = await fetch(`${CATALOG_BASE}/products/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
            if (!res.ok) throw new Error('delete failed');
            Alert.alert('Deleted');
            fetchCatalog();
          } catch (err) {
            console.error('deleteProduct', err);
            Alert.alert('Error', 'Could not delete product');
          }
        }
      }
    ]);
  };

  // ------- UI components -------
  const CategoryStory = ({ item }) => (
    <TouchableOpacity onPress={() => {
      // select category filter
      setSearchQuery('');
      // scroll to show products of this category by setting searchQuery to category name? user likely expects filter.
      setSearchQuery(item.name || '');
    }} style={styles.storyCard}>
      <View style={styles.storyImageWrap}>
        {item.image ? <Image source={{ uri: item.image }} style={styles.storyImage} /> : <View style={styles.storyImagePlaceholder}><MaterialIcons name="category" size={26} color={Colors.light.textSecondary} /></View>}
      </View>
      <Text numberOfLines={1} style={styles.storyLabel}>{item.name}</Text>
    </TouchableOpacity>
  );

  const ProductCard = ({ item }) => {
    const isOut = Number(item.stock) <= 0;
    const unitDisplay = item.unitSize ? `${item.unitSize}${item.unit}` : item.unit;
    return (
      <View style={styles.productCard}>
        <View style={styles.productLeft}>
          <Image source={{ uri: item.image || 'https://via.placeholder.com/200' }} style={styles.productMainImage} />
        </View>
        <View style={styles.productRight}>
          <View style={styles.productHeaderRow}>
            <Text style={styles.productName}>{item.name}</Text>
            <TouchableOpacity onPress={() => deleteProduct(item._id)} style={styles.trashBtn}>
              <Feather name="trash-2" size={18} color="#F44336" />
            </TouchableOpacity>
          </View>
          <Text style={styles.productCategoryText}>{item.category?.name || 'Uncategorized'} • ₹{item.price}</Text>
          {item.description ? <Text numberOfLines={2} style={styles.productDescriptionText}>{item.description}</Text> : null}
          <View style={styles.productFooter}>
            <Text style={[styles.stockText, isOut && { color: '#F44336' }]}>{item.stock} in stock</Text>
            <TouchableOpacity style={styles.editBtn} onPress={() => openEditProduct(item)}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ------- Export helper (simple CSV) -------
  const exportProductsCSV = async () => {
    const rows = [['id', 'name', 'category', 'price', 'stock', 'tags']];
    (products || []).forEach(p => {
      rows.push([p._id, p.name, p.category?.name || '', p.price, p.stock, Array.isArray(p.tags) ? p.tags.join(';') : (p.tags || '')]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    try {
      await Share.share({ message: csv, title: 'Products CSV' });
    } catch (e) {
      Alert.alert('Export failed', 'Unable to share CSV');
    }
  };

  // ------- Render -------
  if (authLoading || loading) {
    return (
      <View style={[styles.centered, { flex: 1, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={{ marginTop: 12, color: Colors.light.textSecondary }}>Loading catalog…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Catalog</Text>
          <Text style={styles.subtitle}>{categories.length} categories • {products.length} products</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={exportProductsCSV} style={styles.exportBtn}>
            {/* <Feather name="download" size={18} color:'#131111ff' />
             */}
            <Text style={styles.exportBtnText}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Categories "stories" */}
      <View style={{ height: 118, backgroundColor: Colors.light.background }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyScroll}>
          {categories.map(cat => <CategoryStory key={cat._id} item={cat} />)}
          <TouchableOpacity style={styles.storyAdd} onPress={openCreateCategory}>
            <View style={styles.storyAddCircle}><Ionicons name="add" size={28} color="#FFF" /></View>
            <Text numberOfLines={1} style={styles.storyLabel}>Add</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={Colors.light.textSecondary} />
          <TextInput placeholder="Search products..." style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery ? <TouchableOpacity onPress={() => setSearchQuery('')}><Ionicons name="close-circle" size={18} color={Colors.light.textSecondary} /></TouchableOpacity> : null}
        </View>
      </View>

      {/* Product feed */}
      <FlatList
        data={filteredProducts}
        keyExtractor={p => p._id}
        renderItem={({ item }) => <ProductCard item={item} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.accent} colors={[Colors.light.accent]} />}
        ListEmptyComponent={<View style={{ alignItems:'center', padding:40 }}><Text style={{color:Colors.light.textSecondary}}>No products</Text></View>}
      />

      {/* Add Product FAB (bottom-right) */}
      <TouchableOpacity style={styles.fab} onPress={openCreateProduct}>
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* ---------------- Category Modal ---------------- */}
      <Modal visible={catModalVisible} animationType="slide" onRequestClose={() => setCatModalVisible(false)} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCategory ? 'Edit Category' : 'Create Category'}</Text>
              <TouchableOpacity onPress={() => setCatModalVisible(false)}><MaterialIcons name="close" size={22} color={Colors.light.text} /></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }}>
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput value={catForm.name} onChangeText={(t)=>setCatForm(f=>({...f, name:t}))} style={styles.input} placeholder="Category name" />
              <Text style={[styles.inputLabel,{marginTop:12}]}>Description</Text>
              <TextInput value={catForm.description} onChangeText={(t)=>setCatForm(f=>({...f, description:t}))} style={[styles.input, {height:100, textAlignVertical:'top'}]} multiline />
              <Text style={[styles.inputLabel,{marginTop:12}]}>Display Order</Text>
              <TextInput value={String(catForm.displayOrder ?? 0)} onChangeText={(t)=>setCatForm(f=>({...f, displayOrder: parseInt(t)||0}))} keyboardType="numeric" style={styles.input} />
              <Text style={[styles.inputLabel,{marginTop:12}]}>Image URL or pick</Text>
              <View style={{flexDirection:'row', gap:8}}>
                <TextInput value={catForm.image} onChangeText={(t)=>setCatForm(f=>({...f, image:t}))} placeholder="http(s)://..." style={[styles.input,{flex:1}]} />
                <TouchableOpacity style={styles.imagePickBtn} onPress={async ()=>{ const u=await pickSingleImageAndCompress(); if(u) setCatForm(f=>({...f,image:u})); }}>
                  <Ionicons name="image" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
              {catForm.image ? <Image source={{uri: catForm.image}} style={{width:120,height:80,marginTop:12,borderRadius:8}} /> : null}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancel} onPress={()=>setCatModalVisible(false)} disabled={catSubmitting}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={submitCategory} disabled={catSubmitting}><Text style={styles.modalSaveText}>{catSubmitting ? 'Saving...' : (editingCategory ? 'Update' : 'Create')}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------- Product Modal ---------------- */}
      <Modal visible={prodModalVisible} animationType="slide" onRequestClose={() => setProdModalVisible(false)} transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, {maxHeight: height - 80}]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingProduct ? 'Edit Product' : 'Create Product'}</Text>
              <TouchableOpacity onPress={() => setProdModalVisible(false)}><MaterialIcons name="close" size={22} color={Colors.light.text} /></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              {/* name */}
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput style={styles.input} value={prodForm.name} onChangeText={t=>setProdForm(f=>({...f, name:t}))} placeholder="Product name" />
              {/* description */}
              <Text style={[styles.inputLabel,{marginTop:12}]}>Description</Text>
              <TextInput style={[styles.input,{height:100,textAlignVertical:'top'}]} value={prodForm.description} onChangeText={t=>setProdForm(f=>({...f, description:t}))} multiline />
              {/* category */}
              <Text style={[styles.inputLabel,{marginTop:12}]}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>
                {categories.map(cat => (
                  <TouchableOpacity key={cat._id} style={[styles.chip, prodForm.category === cat._id && styles.chipSelected]} onPress={()=>setProdForm(f=>({...f, category: cat._id}))}>
                    <Text style={[styles.chipText, prodForm.category === cat._id && styles.chipTextSelected]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* price/discount row */}
              <View style={{flexDirection:'row', gap:8}}>
                <View style={{flex:1}}>
                  <Text style={styles.inputLabel}>Price (₹) *</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={prodForm.price} onChangeText={t=>setProdForm(f=>({...f, price:t}))} />
                </View>
                <View style={{width:110}}>
                  <Text style={styles.inputLabel}>Discount (%)</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={prodForm.discount} onChangeText={t=>setProdForm(f=>({...f, discount:t}))} />
                </View>
              </View>

              {/* unit/size */}
              <View style={{flexDirection:'row', gap:8, marginTop:12}}>
                <View style={{flex:1}}>
                  <Text style={styles.inputLabel}>Unit</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical:8}}>
                    {['ml','liter','gm','kg','pack','piece'].map(u=>(
                      <TouchableOpacity key={u} style={[styles.chip, prodForm.unit===u && styles.chipSelected]} onPress={()=>setProdForm(f=>({...f,unit:u}))}>
                        <Text style={[styles.chipText, prodForm.unit===u && styles.chipTextSelected]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={{width:110}}>
                  <Text style={styles.inputLabel}>Size</Text>
                  <TextInput style={styles.input} value={prodForm.unitSize} keyboardType="numeric" onChangeText={t=>setProdForm(f=>({...f,unitSize:t}))} />
                </View>
              </View>

              {/* stock & milk type */}
              <View style={{flexDirection:'row', gap:8, marginTop:12}}>
                <View style={{flex:1}}>
                  <Text style={styles.inputLabel}>Stock</Text>
                  <TextInput style={styles.input} value={prodForm.stock} keyboardType="numeric" onChangeText={t=>setProdForm(f=>({...f, stock:t}))} />
                </View>
                <View style={{flex:1}}>
                  <Text style={styles.inputLabel}>Milk Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical:8}}>
                    {['Cow','Buffalo','Mixed','None'].map(m=>(
                      <TouchableOpacity key={m} style={[styles.chip, prodForm.milkType===m && styles.chipSelected]} onPress={()=>setProdForm(f=>({...f,milkType:m}))}>
                        <Text style={[styles.chipText, prodForm.milkType===m && styles.chipTextSelected]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* main image */}
              <Text style={[styles.inputLabel,{marginTop:8}]}>Main Image</Text>
              <View style={{flexDirection:'row', gap:8, alignItems:'center'}}>
                <TouchableOpacity style={styles.imageUploadBtn} onPress={pickProductMainImage}><Ionicons name="image" size={20} color={Colors.light.accent} /><Text style={{marginLeft:8}}>Pick Image</Text></TouchableOpacity>
                {prodForm.image?.uri ? <Image source={{uri:prodForm.image.uri}} style={{width:80,height:60,borderRadius:6}} /> : editingProduct?.image ? <Image source={{uri:editingProduct.image}} style={{width:80,height:60,borderRadius:6}} /> : null}
              </View>

              {/* additional images */}
              <Text style={[styles.inputLabel,{marginTop:12}]}>Additional Images</Text>
              <View style={{flexDirection:'row', gap:8, marginTop:8}}>
                <TouchableOpacity style={styles.imageUploadBtn} onPress={pickProductAdditional}><Ionicons name="images" size={20} color={Colors.light.accent} /><Text style={{marginLeft:8}}>Add Images</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal style={{marginTop:12}}>
                {[...(prodForm.images||[]), ...newAdditionalImages].map(img => {
                  const uri = img.uri || img.image;
                  return (
                    <View key={uri} style={{marginRight:12, position:'relative'}}>
                      <Image source={{uri}} style={{width:100,height:70,borderRadius:8}} />
                      <TouchableOpacity style={{position:'absolute', top:-6, right:-6, backgroundColor:'#F44336', width:22, height:22, borderRadius:11, justifyContent:'center', alignItems:'center'}} onPress={()=>removeAdditionalImage(img)}>
                        <Ionicons name="close" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>

              {/* nutrition */}
              <Text style={[styles.inputLabel,{marginTop:12}]}>Nutrition (per 100{prodForm.unit})</Text>
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
                {['fat','protein','calories','carbohydrates'].map(k=>(
                  <View key={k} style={{width:'48%', marginTop:8}}>
                    <Text style={{fontSize:12,color:Colors.light.textSecondary,marginBottom:6}}>{k.charAt(0).toUpperCase()+k.slice(1)}</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={prodForm.nutritionalInfo[k]} onChangeText={t=>setProdForm(prev=>({...prev, nutritionalInfo:{...prev.nutritionalInfo, [k]:t}}))} />
                  </View>
                ))}
              </View>

              {/* tags */}
              <Text style={[styles.inputLabel,{marginTop:12}]}>Tags (comma separated)</Text>
              <TextInput style={styles.input} value={prodForm.tags} onChangeText={t=>setProdForm(f=>({...f,tags:t}))} placeholder="organic, fresh, premium" />

              {/* toggles */}
              <View style={{flexDirection:'row', gap:12, marginTop:12}}>
                <TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:8}} onPress={()=>setProdForm(f=>({...f,isFeatured:!f.isFeatured}))}>
                  <View style={[styles.checkbox, prodForm.isFeatured && styles.checkboxOn]}>{prodForm.isFeatured && <Ionicons name="checkmark" size={14} color="#fff" />}</View><Text>Featured</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:8}} onPress={()=>setProdForm(f=>({...f,isAvailable:!f.isAvailable}))}>
                  <View style={[styles.checkbox, prodForm.isAvailable && styles.checkboxOn]}>{prodForm.isAvailable && <Ionicons name="checkmark" size={14} color="#fff" />}</View><Text>Available</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancel} onPress={()=>setProdModalVisible(false)} disabled={prodUploading}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={submitProduct} disabled={prodUploading}><Text style={styles.modalSaveText}>{prodUploading ? 'Saving...' : (editingProduct ? 'Update' : 'Create')}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ---------------- Styles ----------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centered: { flex:1, justifyContent:'center', alignItems:'center' },

  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, backgroundColor: Colors.light.white, borderBottomWidth:1, borderBottomColor:'#EEE' },
  title: { fontSize:20, fontWeight:'800', color: Colors.light.text },
  subtitle: { fontSize:13, color: Colors.light.textSecondary },

  exportBtn: { flexDirection:'row', alignItems:'center', backgroundColor: Colors.light.accent, paddingHorizontal:12, paddingVertical:8, borderRadius:10 },
  exportBtnText: { color:'#fff', marginLeft:8, fontWeight:'700' },

  storyScroll: { alignItems:'center', paddingHorizontal:12, gap:12 },
  storyCard: { width:80, alignItems:'center', marginHorizontal:6 },
  storyImageWrap: { width:64, height:64, borderRadius:32, overflow:'hidden', borderWidth:3, borderColor:'#2dd4bf20', justifyContent:'center', alignItems:'center', backgroundColor:'#fff' },
  storyImage: { width:64, height:64 },
  storyImagePlaceholder: { width:64, height:64, justifyContent:'center', alignItems:'center' },
  storyLabel: { fontSize:12, marginTop:6, color: Colors.light.text, textAlign:'center', width:80 },

  storyAdd: { width:80, alignItems:'center', marginHorizontal:6 },
  storyAddCircle: { width:64, height:64, borderRadius:32, backgroundColor: Colors.light.accent, justifyContent:'center', alignItems:'center' },

  searchWrap: { paddingHorizontal:16, paddingVertical:12, backgroundColor: Colors.light.background },
  searchBox: { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', paddingHorizontal:12, borderRadius:12, borderWidth:1, borderColor: Colors.light.border, gap:8 },
  searchInput: { flex:1, paddingVertical:10, color: Colors.light.text },

  // product card
  productCard: { flexDirection:'row', backgroundColor:'#fff', borderRadius:12, marginBottom:12, overflow:'hidden', borderWidth:1, borderColor: Colors.light.border },
  productLeft: { width:120, height:120, overflow:'hidden' },
  productMainImage: { width:120, height:120 },
  productRight: { flex:1, padding:12, justifyContent:'space-between' },
  productHeaderRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  productName: { fontSize:16, fontWeight:'700', color: Colors.light.text },
  productCategoryText: { fontSize:12, color: Colors.light.textSecondary, marginTop:4 },
  productDescriptionText: { fontSize:13, color: Colors.light.textSecondary, marginTop:6 },
  productFooter: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:8 },
  stockText: { fontSize:12, color: Colors.light.textSecondary },
  editBtn: { backgroundColor:'#06b6d4', paddingHorizontal:12, paddingVertical:6, borderRadius:8 },
  editBtnText: { color:'#fff', fontWeight:'700' },
  trashBtn: { padding:6 },

  fab: { position:'absolute', right:20, bottom:24, width:56, height:56, borderRadius:28, backgroundColor: Colors.light.accent, justifyContent:'center', alignItems:'center', elevation:8 },

  // modal
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'flex-end' },
  modalCard: { backgroundColor:'#fff', borderTopLeftRadius:16, borderTopRightRadius:16, maxHeight: '85%' },
  modalHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor: Colors.light.border },
  modalTitle: { fontSize:18, fontWeight:'800', color: Colors.light.text },
  modalFooter: { flexDirection:'row', padding:16, borderTopWidth:1, borderTopColor: Colors.light.border },
  modalCancel: { flex:1, backgroundColor:'#F3F4F6', paddingVertical:12, borderRadius:8, alignItems:'center', justifyContent:'center' },
  modalCancelText: { color: Colors.light.text, fontWeight:'700' },
  modalSave: { flex:1, backgroundColor: Colors.light.accent, paddingVertical:12, borderRadius:8, marginLeft:12, alignItems:'center', justifyContent:'center' },
  modalSaveText: { color:'#fff', fontWeight:'800' },

  // inputs
  inputLabel: { fontSize:13, color: Colors.light.text, marginBottom:6, marginTop:6, fontWeight:'700' },
  input: { borderWidth:1, borderColor: Colors.light.border, borderRadius:8, padding:10, backgroundColor:'#fff', fontSize:14, color: Colors.light.text },

  imagePickBtn: { backgroundColor: Colors.light.accent, padding:10, borderRadius:8, justifyContent:'center', alignItems:'center' },
  imageUploadBtn: { flexDirection:'row', alignItems:'center', padding:10, borderRadius:8, borderWidth:1, borderColor: Colors.light.border, backgroundColor:'#fafafa' },

  chip: { paddingHorizontal:12, paddingVertical:8, backgroundColor:'#F3F4F6', borderRadius:20, marginRight:8 },
  chipSelected: { backgroundColor: Colors.light.accent },
  chipText: { color: Colors.light.text },
  chipTextSelected: { color:'#fff', fontWeight:'700' },

  checkbox: { width:20, height:20, borderRadius:4, borderWidth:1, borderColor: Colors.light.border, justifyContent:'center', alignItems:'center' },
  checkboxOn: { backgroundColor: Colors.light.accent, borderColor: Colors.light.accent },

});
