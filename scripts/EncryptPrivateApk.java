import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/** Encrypt a private Superpowered evaluation APK, never distribute a plain APK artifact. */
public final class EncryptPrivateApk {
    public static void main(String[] args) throws Exception {
        if (args.length != 3) throw new IllegalArgumentException("usage: <apk> <public-key-pem> <encrypted-output>");
        byte[] plaintext=Files.readAllBytes(Path.of(args[0]));
        if (plaintext.length<1000 || plaintext.length>200_000_000) throw new IllegalArgumentException("Unexpected APK size");
        String pem=Files.readString(Path.of(args[1]));
        String b64=pem.replaceAll("-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\\s", "");
        PublicKey publicKey=KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(b64)));
        KeyGenerator generator=KeyGenerator.getInstance("AES");
        generator.init(256,new SecureRandom());
        SecretKey key=generator.generateKey();
        byte[] nonce=new byte[12];new SecureRandom().nextBytes(nonce);
        Cipher aes=Cipher.getInstance("AES/GCM/NoPadding");
        aes.init(Cipher.ENCRYPT_MODE,key,new GCMParameterSpec(128,nonce));
        byte[] encrypted=aes.doFinal(plaintext);
        Cipher rsa=Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
        rsa.init(Cipher.ENCRYPT_MODE,publicKey,
            new javax.crypto.spec.OAEPParameterSpec("SHA-256", "MGF1",
                java.security.spec.MGF1ParameterSpec.SHA256,
                javax.crypto.spec.PSource.PSpecified.DEFAULT));
        byte[] wrapped=rsa.doFinal(key.getEncoded());
        try(DataOutputStream output=new DataOutputStream(Files.newOutputStream(Path.of(args[2])))) {
            output.writeInt(0x41555342); // ASCII AUSB
            output.writeInt(1); // envelope version
            output.writeInt(wrapped.length); output.write(wrapped);
            output.writeInt(nonce.length);output.write(nonce);
            output.write(encrypted); // AES-GCM authenticates full encrypted APK
        }
        System.out.println("Encrypted evaluation APK, no plaintext artifact uploaded; output="+args[2]);
        java.util.Arrays.fill(plaintext,(byte)0);
    }
}
