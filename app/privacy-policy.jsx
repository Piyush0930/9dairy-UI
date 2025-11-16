import Colors from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PrivacyPolicy() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.lastUpdated}>Last updated: December 2024</Text>

          <Text style={styles.paragraph}>
            At Dairy Nine, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.
          </Text>

          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          <Text style={styles.subTitle}>Personal Information:</Text>
          <Text style={styles.bulletPoint}>• Full name, email address, and phone number</Text>
          <Text style={styles.bulletPoint}>• Delivery address and location coordinates</Text>
          <Text style={styles.bulletPoint}>• Date of birth and other profile information</Text>
          <Text style={styles.bulletPoint}>• Payment information (processed securely by third-party providers)</Text>

          <Text style={styles.subTitle}>Usage Information:</Text>
          <Text style={styles.bulletPoint}>• Order history and preferences</Text>
          <Text style={styles.bulletPoint}>• App usage patterns and device information</Text>
          <Text style={styles.bulletPoint}>• Location data for delivery services</Text>

          <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
          <Text style={styles.bulletPoint}>• Process and fulfill your orders</Text>
          <Text style={styles.bulletPoint}>• Provide customer support and respond to inquiries</Text>
          <Text style={styles.bulletPoint}>• Improve our services and develop new features</Text>
          <Text style={styles.bulletPoint}>• Send important updates about your orders</Text>
          <Text style={styles.bulletPoint}>• Ensure platform security and prevent fraud</Text>
          <Text style={styles.bulletPoint}>• Comply with legal obligations</Text>

          <Text style={styles.sectionTitle}>3. Information Sharing</Text>
          <Text style={styles.paragraph}>
            We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
          </Text>
          <Text style={styles.bulletPoint}>• With delivery partners to fulfill your orders</Text>
          <Text style={styles.bulletPoint}>• With payment processors for secure transactions</Text>
          <Text style={styles.bulletPoint}>• When required by law or to protect our rights</Text>
          <Text style={styles.bulletPoint}>• With your explicit consent</Text>

          <Text style={styles.sectionTitle}>4. Data Security</Text>
          <Text style={styles.paragraph}>
            We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes:
          </Text>
          <Text style={styles.bulletPoint}>• Encryption of sensitive data in transit and at rest</Text>
          <Text style={styles.bulletPoint}>• Secure authentication and access controls</Text>
          <Text style={styles.bulletPoint}>• Regular security audits and updates</Text>
          <Text style={styles.bulletPoint}>• Limited access to personal data on a need-to-know basis</Text>

          <Text style={styles.sectionTitle}>5. Data Retention</Text>
          <Text style={styles.paragraph}>
            We retain your personal information for as long as necessary to provide our services and comply with legal obligations. Order history and account information are typically retained for 7 years for tax and regulatory purposes, unless a longer retention period is required by law.
          </Text>

          <Text style={styles.sectionTitle}>6. Your Rights</Text>
          <Text style={styles.paragraph}>
            You have the following rights regarding your personal information:
          </Text>
          <Text style={styles.bulletPoint}>• Access: Request a copy of your personal data</Text>
          <Text style={styles.bulletPoint}>• Rectification: Correct inaccurate or incomplete information</Text>
          <Text style={styles.bulletPoint}>• Erasure: Request deletion of your personal data</Text>
          <Text style={styles.bulletPoint}>• Portability: Receive your data in a structured format</Text>
          <Text style={styles.bulletPoint}>• Restriction: Limit how we process your data</Text>
          <Text style={styles.bulletPoint}>• Objection: Object to certain types of processing</Text>

          <Text style={styles.sectionTitle}>7. Cookies and Tracking</Text>
          <Text style={styles.paragraph}>
            Our mobile application may use cookies and similar technologies to enhance your experience. We may also collect anonymous usage statistics to improve our services. You can manage cookie preferences through your device settings.
          </Text>

          <Text style={styles.sectionTitle}>8. Third-Party Services</Text>
          <Text style={styles.paragraph}>
            Our app may integrate with third-party services such as payment processors and mapping services. These services have their own privacy policies, and we encourage you to review them. We are not responsible for the privacy practices of these third parties.
          </Text>

          <Text style={styles.sectionTitle}>9. Children's Privacy</Text>
          <Text style={styles.paragraph}>
            Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.
          </Text>

          <Text style={styles.sectionTitle}>10. International Data Transfers</Text>
          <Text style={styles.paragraph}>
            Your information may be transferred to and processed in countries other than your own. We ensure that such transfers comply with applicable data protection laws and implement appropriate safeguards.
          </Text>

          <Text style={styles.sectionTitle}>11. Changes to This Policy</Text>
          <Text style={styles.paragraph}>
            We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy in the app and updating the "Last updated" date. Your continued use of our services after such changes constitutes acceptance of the updated policy.
          </Text>

          <Text style={styles.sectionTitle}>12. Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have any questions about this Privacy Policy or our data practices, please contact us:
          </Text>
          <Text style={styles.contactInfo}>Email: privacy@dairynine.com</Text>
          <Text style={styles.contactInfo}>Phone: +91-XXXXXXXXXX</Text>
          <Text style={styles.contactInfo}>Address: [Your Business Address]</Text>

          <Text style={styles.footer}>
            By using Dairy Nine, you acknowledge that you have read and understood this Privacy Policy.
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
  },
  content: {
    paddingHorizontal: 20,
  },
  lastUpdated: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 24,
    marginBottom: 12,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.light.text,
    marginBottom: 16,
  },
  bulletPoint: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.light.text,
    marginBottom: 8,
    paddingLeft: 16,
  },
  contactInfo: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.light.tint,
    marginBottom: 8,
    paddingLeft: 16,
  },
  footer: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bottomPadding: {
    height: 40,
  },
});
