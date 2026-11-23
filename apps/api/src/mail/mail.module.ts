import { Global, Injectable, Logger, Module } from '@nestjs/common';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

// ponytail: les emails sont seulement journalisés. Brancher un vrai fournisseur (SMTP, SendGrid…) ici.
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  /** Derniers emails envoyés, lus par les tests. */
  readonly outbox: Mail[] = [];

  /** Destinataire sans email (compte créé par l'école, connexion par téléphone) : rien à envoyer. */
  send({ to, ...rest }: Omit<Mail, 'to'> & { to: string | null }) {
    if (!to) return;
    const mail = { to, ...rest };
    this.outbox.push(mail);
    if (this.outbox.length > 200) this.outbox.shift();
    this.logger.log(`→ ${mail.to} · ${mail.subject}\n${mail.text}`);
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
