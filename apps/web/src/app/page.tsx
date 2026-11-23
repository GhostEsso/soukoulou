import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { REFRESH_COOKIE } from "@/lib/session";

export default async function Home() {
  // ponytail: pas encore de page vitrine — on oriente vers l'espace ou la connexion.
  redirect((await cookies()).has(REFRESH_COOKIE) ? "/espace" : "/connexion");
}
