import type { Metadata, Viewport } from 'next';
import { Poppins, Montserrat } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import './consultation-admin.css';
import ConnectivityWrapper from '@/components/ui/ConnectivityWrapper';
import StoreProvider from '@/store/StoreProvider';
import LayoutConditionalWrapper from '@/components/ui/LayoutConditionalWrapper';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'react-hot-toast';
import AuthSocketBridge from '@/context/AuthSocketBridge';
import { GoogleMapsProvider } from '@/context/GoogleMapsProvider';
 
import ToastProvider from '../providers/ToastProvider';
import SupportErrorBoundary from '../providers/SupportErrorBoundary';
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#0F172A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://likeson.in'),

  title: {
    default: 'Likeson Healthcare | Premium Medical Services & Family Care',
    template: '%s | Likeson Healthcare',
  },
  description:
    'A comprehensive, tech-enabled healthcare solution delivering essential medical transport, doctor consultations, premium home care, pharmacy deliveries, and lab diagnostics.',
  applicationName: 'Likeson',
  authors: [{ name: 'Likeson Team', url: 'https://likeson.in' }],
  creator: 'Likeson Healthcare',
  publisher: 'Likeson Healthcare',

  keywords: [
    'healthcare',
    'medical transport',
    'Transport booking India',
    'online doctor consultation',
    'home healthcare',
    'pharmacy delivery',
    'lab tests at home',
    'telemedicine',
    'family medical care',
    'Likeson Healthcare',
  ],

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  alternates: {
    canonical: '/',
  },

  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://likeson.in',
    title: 'Likeson Healthcare | Comprehensive Family Medical Care',
    description:
      'Tech-enabled healthcare solution delivering essential non-emergency services, medical transport, and clinical support right to your door.',
    siteName: 'Likeson Healthcare',
    images: [
      {
        url: '/Logo.ico', // Fixed path
        width: 1200,
        height: 630,
        alt: 'Likeson Healthcare Services Overview',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Likeson Healthcare | Family Medical Care',
    description:
      'Tech-enabled healthcare solution delivering essential non-emergency services, medical transport, and clinical support.',
    images: ['/twitter-image.jpg'], 
    creator: '@LikesonHealth',
  },

  icons: {
    icon: [
      { url: '/Logo.ico' }, // Fixed path
      { url: '/Logo.ico', type: 'image/x-icon' }, // Fixed path and corrected MIME type for .ico
    ],
    shortcut: ['/Logo.ico'],
    apple: [{ url: '/apple-icon.png' }],
  },

  appleWebApp: {
    title: 'Likeson',
    statusBarStyle: 'default',
    capable: true,
  },

  verification: {
    // google: 'your-google-search-console-string-here',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${montserrat.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <body className="font-poppins antialiased" suppressHydrationWarning>
        <StoreProvider>
          <ToastProvider>
          <ThemeProvider attribute="class" defaultTheme="dark">
            <AuthSocketBridge>
              <GoogleMapsProvider>
                <ConnectivityWrapper>
                  <LayoutConditionalWrapper>
                    <SupportErrorBoundary>
                    {children}
                    </SupportErrorBoundary>
                  </LayoutConditionalWrapper>
               
                </ConnectivityWrapper>
              </GoogleMapsProvider>
            </AuthSocketBridge>

           
          </ThemeProvider>
          </ToastProvider>
        </StoreProvider>

        <Analytics />
      </body>
    </html>
  );
}