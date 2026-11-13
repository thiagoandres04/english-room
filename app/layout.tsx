import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'English Room · Tu espacio para evaluar',description:'Transformá tus ejercicios resueltos en exámenes de inglés para tus alumnos.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><head><meta name="referrer" content="no-referrer"/></head><body>{children}</body></html>}
