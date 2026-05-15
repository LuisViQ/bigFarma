import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { get, ref } from "firebase/database";
import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "~/components/button";
import { Input } from "~/components/input";
import { auth, db } from "~/services/firebase/firebase";
export function meta() {
  return [{ title: "BigFarma | Login" }];
}
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;
      console.log("[Usuário encontrado]:", user);

      const userRef = ref(db, `users/${user.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        console.log("[Usuário autenticado no banco]");
        const userData = snapshot.val();
        localStorage.setItem("@BigFarma:userRole", userData.role);
        navigate("/home");
      }
    } catch (error) {
      alert("Erro ao autenticar. Verifique suas credenciais.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      alert(
        "Por favor, digite seu e-mail no campo acima para recuperar a senha.",
      );
      return;
    }

    setIsResetting(true);

    try {
      await sendPasswordResetEmail(auth, email);
      alert("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar o e-mail. Verifique se o endereço está correto.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-[#f5f5f5]">
      <form
        className="w-full max-w-100 p-7.5 bg-white rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
        onSubmit={handleLogin}
      >
        <h2 className="text-center mb-7.5 text-2xl font-bold text-gray-800">
          Acesso Restrito
        </h2>

        <Input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* Container para alinhar o link à direita */}
        <div className="flex justify-end mb-4 -mt-2">
          <button
            type="button" // O type="button" impede que ele dispare o onSubmit do form
            onClick={handleResetPassword}
            disabled={isResetting || isLoading}
            className="text-sm text-[#007AFF] hover:text-blue-800 transition-colors bg-transparent border-none cursor-pointer disabled:opacity-50"
          >
            {isResetting ? "Enviando..." : "Esqueceu sua senha?"}
          </button>
        </div>

        <Button type="submit" isLoading={isLoading} disabled={isResetting}>
          Entrar
        </Button>
      </form>
    </div>
  );
}
