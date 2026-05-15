import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "~/services/firebase/firebase";
import { Loader2 } from "lucide-react"; // Opcional, para um loading bonito

export default function PrivateLayout() {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // O Firebase verifica quem está logado ANTES de renderizar as telas internas
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/"); // Bloqueia e manda pro login
      } else {
        setIsAuthLoading(false); // Libera o acesso
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Tela de espera global (aparece por milissegundos enquanto o Firebase responde)
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-lg font-bold text-blue-900 tracking-widest uppercase animate-pulse">
          Autenticando...
        </p>
      </div>
    );
  }

  // Se passou na segurança, o <Outlet /> renderiza a tela que o usuário pediu (Home ou History)
  return <Outlet />;
}
