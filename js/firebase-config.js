// ══════════════════════════════════════════════════════════════
//  CONFIGURAÇÃO DO FIREBASE
//  Substitua os valores abaixo pelos da sua conta Firebase
//  Siga o guia COMO-PUBLICAR.md para obter essas informações
// ══════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey:            "COLE_AQUI_SUA_API_KEY",
  authDomain:        "COLE_AQUI.firebaseapp.com",
  projectId:         "COLE_AQUI_SEU_PROJECT_ID",
  storageBucket:     "COLE_AQUI.appspot.com",
  messagingSenderId: "COLE_AQUI_SENDER_ID",
  appId:             "COLE_AQUI_APP_ID"
};

firebase.initializeApp(firebaseConfig);
