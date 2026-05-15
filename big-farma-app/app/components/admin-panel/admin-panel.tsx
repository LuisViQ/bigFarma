import React, { useState } from "react";
import { ref, push, set } from "firebase/database";
import { db } from "~/services/firebase/firebase";
import { Input } from "../input";
import { Button } from "../button";

export function AdminPanel() {
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !preco) return alert("Preencha nome e preço.");
    if (!codigo) return alert("Preencha o código.");
    setIsLoading(true);
    try {
      const examsRef = ref(db, "exames");
      const newExamRef = push(examsRef);
      await set(newExamRef, {
        codigo: codigo,
        nome,
        preco: parseFloat(preco),
        criadoEm: new Date().toISOString(),
      });

      alert("Exame cadastrado com sucesso!");
      setCodigo("");
      setNome("");
      setPreco("");
    } catch (error) {
      alert("Erro ao cadastrar exame.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-xl">
      <h2 className="text-xl font-bold mb-4 text-blue-900">
        Área do Administrador: Cadastrar Novo Exame
      </h2>
      <form
        onSubmit={handleAddExam}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <Input
          placeholder="Código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
        <div className="md:col-span-2">
          <Input
            placeholder="Nome do Exame"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <Input
          type="number"
          step="0.01"
          placeholder="Preço (R$)"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
        />
        <div className="md:col-span-4">
          <Button type="submit" isLoading={isLoading}>
            Adicionar ao Banco de Dados
          </Button>
        </div>
      </form>
    </section>
  );
}
