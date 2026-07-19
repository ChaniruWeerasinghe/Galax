import { Metadata } from 'next';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

type Props = {
  params: Promise<{ id: string }>
};

export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {
  // read route params
  const { id } = await params;
  
  try {
    const docRef = doc(db, 'galleries', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const title = `${data.name} | Galax Studios`;
      const description = `View the exclusive high-end photography gallery for ${data.name}. Hosted by Galax Studios.`;
      
      return {
        title: title,
        description: description,
        openGraph: {
          title: title,
          description: description,
          images: ['/og-image.png'],
          siteName: 'Galax Studios',
        },
        twitter: {
          card: 'summary_large_image',
          title: title,
          description: description,
          images: ['/og-image.png'],
        }
      };
    }
  } catch (error) {
    console.error("Error fetching gallery metadata:", error);
  }

  return {
    title: 'Gallery | Galax Studios',
    description: 'View this exclusive photography gallery hosted by Galax Studios.'
  };
}

export default function GalleryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
