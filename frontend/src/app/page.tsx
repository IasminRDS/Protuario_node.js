import { redirect } from 'next/navigation';

// A raiz manda para o dashboard; o guard do layout protegido redireciona
// para /login se não houver sessão.
export default function Home() {
  redirect('/dashboard');
}
