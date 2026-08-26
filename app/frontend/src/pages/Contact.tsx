/**
 * S — Contact.
 *
 * Submits via a plain mailto: link, no backend endpoint — user's explicit
 * choice (see Section E of the RN migration plan). Nothing here is sent
 * anywhere until the visitor's own email app actually sends it.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const SUPPORT_EMAIL = 'support@resqkit.com';

const Contact: React.FC = () => {
  const { t } = useTranslation('contact');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const mailtoHref = () => {
    const body = [message, '', name && `${t('name')}: ${name}`, email && `${t('emailLabel')}: ${email}`]
      .filter(Boolean)
      .join('\n');
    const params = new URLSearchParams({
      subject: subject || t('title'),
      body,
    });
    return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2">
          <Mail className="h-6 w-6 text-primary" aria-hidden="true" />
          {t('title')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-2 text-sm text-primary">
            <Mail className="h-4 w-4" aria-hidden="true" />
            {SUPPORT_EMAIL}
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="font-semibold">{t('formTitle')}</p>
          <div className="space-y-1.5">
            <Label htmlFor="contactName">{t('name')}</Label>
            <Input
              id="contactName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactEmail">{t('emailLabel')}</Label>
            <Input
              id="contactEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactSubject">{t('subject')}</Label>
            <Input
              id="contactSubject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('subjectPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactMessage">{t('message')}</Label>
            <Textarea
              id="contactMessage"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('messagePlaceholder')}
              rows={4}
            />
          </div>
          <Button asChild className="w-full">
            <a href={mailtoHref()}>
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('send')}
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">{t('sendHint')}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Contact;
