import React, { type InputHTMLAttributes } from "react";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "50px",
  borderRadius: "8px",
  padding: "0 15px",
  marginBottom: "15px",
  border: "1px solid #ddd",
  fontSize: "16px",
};

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input style={inputStyle} {...props} />;
}
