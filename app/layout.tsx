import './globals.css';
import { Shell } from '@/components/Shell';
export const metadata = { title:'Ubique — Application CRM', description:'Cockpit personnel de candidatures finance' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="fr"><body><Shell>{children}</Shell></body></html>; }
