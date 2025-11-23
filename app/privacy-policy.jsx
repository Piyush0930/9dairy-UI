import Colors from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PrivacyPolicy() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-white px-5 py-4 border-b border-[#F0F0F0]">
        <TouchableOpacity
          className="p-1"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Privacy Policy</Text>
        <View className="w-6" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5">
          <Text className="text-sm text-gray-600 mb-5 text-center italic">Last updated: December 2024</Text>

          <Text className="text-base leading-6 text-gray-900 mb-4">
            At Dairy Nine, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.
          </Text>

          <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">1. Information We Collect</Text>
          <Text className="text-base font-semibold text-gray-900 mt-4 mb-2">Personal Information:</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Full name, email address, and phone number</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Delivery address and location coordinates</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Date of birth and other profile information</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Payment information (processed securely by third-party providers)</Text>

          <Text className="text-base font-semibold text-gray-900 mt-4 mb-2">Usage Information:</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Order history and preferences</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• App usage patterns and device information</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Location data for delivery services</Text>

          <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">2. How We Use Your Information</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Process and fulfill your orders</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Provide customer support and respond to inquiries</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Improve our services and develop new features</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Send important updates about your orders</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Ensure platform security and prevent fraud</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Comply with legal obligations</Text>

          <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">3. Information Sharing</Text>
          <Text className="text-base leading-6 text-gray-900 mb-4">
            We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
          </Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• With delivery partners to fulfill your orders</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• With payment processors for secure transactions</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• When required by law or to protect our rights</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• With your explicit consent</Text>

          <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">4. Data Security</Text>
          <Text className="text-base leading-6 text-gray-900 mb-4">
            We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes:
          </Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Encryption of sensitive data in transit and at rest</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Secure authentication and access controls</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Regular security audits and updates</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Limited access to personal data on a need-to-know basis</Text>

          <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">5. Data Retention</Text>
          <Text className="text-base leading-6 text-gray-900 mb-4">
            We retain your personal information for as long as necessary to provide our services and comply with legal obligations. Order history and account information are typically retained for 7 years for tax and regulatory purposes, unless a longer retention period is required by law.
          </Text>

          <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">6. Your Rights</Text>
          <Text className="text-base leading-6 text-gray-900 mb-4">
            You have the following rights regarding your personal information:
          </Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Access: Request a copy of your personal data</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Rectification: Correct inaccurate or incomplete information</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Erasure: Request deletion of your personal data</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Portability: Receive your data in a structured format</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Restriction: Limit how we process your data</Text>
          <Text className="text-base leading-6 text-gray-900 mb-2 pl-4">• Objection: Object to certain types of processing</Text>

          <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">7. Cookies and Tracking</Text>
          <Text className="text-base leading-6 text-gray-900 mb-4">
            Our mobile application may use cookies and similar technologies to enhance your experience. We may also collect anonymous usage statistics to improve our services. You can manage cookie preferences through your device settings.
          </Text>

          <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">8. Third-Party Services</Text>
          <Text className="text-base leading-6 text-gray-900 mb-4">
            Our app may integrate with third-party services such as payment processors and mapping services. These services have their own privacy policies, and we encourage you to review them. We are not responsible for the privacy practices of these third parties.
          </Text>

          <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">9. Children's Privacy</Text>
          <Text className="text-base leading-6 text-gray-900 mb-4">
            Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.
          </Text>

          <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">10. International Data Transfers</Text>
          <Text className="text-base leading-6 text-gray-900 mb-4">
            Your information may be transferred to and processed in countries other than your own. We ensure that such transfers comply with applicable data protection laws and implement appropriate safeguards.
          </Text>

          <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">11. Changes to This Policy</Text>
          <Text className="text-base leading-6 text-gray-900 mb-4">
            We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy in the app and updating the "Last updated" date. Your continued use of our services after such changes constitutes acceptance of the updated policy.
          </Text>

          <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">12. Contact Us</Text>
          <Text className="text-base leading-6 text-gray-900 mb-4">
            If you have any questions about this Privacy Policy or our data practices, please contact us:
          </Text>
          <Text className="text-base leading-6 text-red-500 mb-2 pl-4">Email: privacy@dairynine.com</Text>
          <Text className="text-base leading-6 text-red-500 mb-2 pl-4">Phone: +91-XXXXXXXXXX</Text>
          <Text className="text-base leading-6 text-red-500 mb-2 pl-4">Address: [Your Business Address]</Text>

          <Text className="text-sm text-gray-600 mt-6 mb-4 text-center italic">
            By using Dairy Nine, you acknowledge that you have read and understood this Privacy Policy.
          </Text>
        </View>

        <View className="h-10" />
      </ScrollView>
    </View>
  );
}