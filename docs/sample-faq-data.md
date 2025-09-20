# Sample FAQ Data

This document provides sample FAQ data that you can customize for your organization.

## FAQ Spreadsheet Structure

Create a "FAQ" sheet in your Google Spreadsheet with these columns:

| Column | Description | Example |
|--------|-------------|---------|
| 質問 (Question) | User question | 集合場所はどこですか？ |
| 回答 (Answer) | Your response | 市民センター1階ロビーです。駐車場もあります。 |
| Embedding | OpenAI vector | (Auto-generated) |

## Generic FAQ Templates

### Basic Activity Information

```csv
質問,回答
活動時間はいつですか？,活動は毎週[曜日]の[時間]から[時間]まで行っています。
集合場所はどこですか？,[場所名]に集合してください。詳しい場所は地図をご確認ください。
持ち物は何が必要ですか？,特に必要な持ち物はありません。動きやすい服装でお越しください。
参加費はかかりますか？,参加費は無料です。お気軽にご参加ください。
初心者でも参加できますか？,はい、初心者の方も大歓迎です。経験豊富なメンバーがサポートします。
雨の日はどうなりますか？,雨天の場合は中止または室内での活動に変更します。当日朝にお知らせします。
連絡先を教えてください,ご質問等は、このLINEでお気軽にお声かけください。
```

### Volunteer Activity Specific

```csv
質問,回答
どんなボランティア活動をしていますか？,主に地域清掃、環境保護、福祉支援活動を行っています。
年齢制限はありますか？,18歳以上の方にご参加いただけます。高校生以下の方は保護者同伴でお願いします。
交通費は支給されますか？,申し訳ございませんが、交通費の支給はありません。
どのくらいの頻度で参加すれば良いですか？,ご都合の良いときにお気軽にご参加ください。強制ではありません。
活動の目的は何ですか？,地域社会の発展と環境保護を目的として活動しています。
```

### Community Circle Specific

```csv
質問,回答
どんな活動をしていますか？,[活動内容]を中心に、地域の皆さんと楽しく活動しています。
会費はいくらですか？,月会費は[金額]円です。体験参加は無料です。
どんな年齢層の方が参加していますか？,[年齢層]の方が中心ですが、どなたでもご参加いただけます。
見学はできますか？,はい、いつでも見学可能です。お気軽にお越しください。
```

### Sports Club Specific

```csv
質問,回答
どんなスポーツをしていますか？,[スポーツ名]を楽しんでいます。レベルに関係なく参加できます。
用具は貸し出してもらえますか？,基本的な用具は貸し出し可能です。個人用品はご持参ください。
怪我をした場合はどうなりますか？,スポーツ保険に加入していますが、自己責任での参加をお願いします。
コーチはいますか？,経験豊富なメンバーが指導します。基礎から丁寧に教えます。
```

## Customization Guidelines

### 1. Organization-Specific Information

Replace placeholder values with your organization's details:

- `[曜日]` → 実際の活動曜日
- `[時間]` → 実際の活動時間
- `[場所名]` → 実際の活動場所
- `[金額]` → 実際の費用
- `[年齢層]` → 実際の参加者年齢層
- `[活動内容]` → 実際の活動内容
- `[スポーツ名]` → 実際のスポーツ種目

### 2. Tone and Style

Adapt the response tone to match your organization:

- **Formal**: ご参加いただき、ありがとうございます。
- **Casual**: みんなで楽しく活動しましょう！
- **Professional**: 専門的な指導を提供いたします。

### 3. Contact Information

Update contact details:

```csv
質問,回答
連絡先を教えてください,[あなたの組織の連絡先]までお気軽にお問い合わせください。
メールアドレスはありますか？,[email@example.com]でもご連絡いただけます。
ウェブサイトはありますか？,詳細は[https://your-website.com]をご覧ください。
```

### 4. Seasonal/Event-Specific FAQs

Add time-sensitive information:

```csv
質問,回答
今度のイベントはいつですか？,[日付]に[イベント名]を開催予定です。
申し込み方法を教えてください,[申し込み方法の説明]
キャンセルはできますか？,[キャンセルポリシーの説明]
```

## FAQ Management Best Practices

### 1. Regular Updates

- Monthly review of FAQ accuracy
- Update contact information seasonally
- Add new questions based on user inquiries

### 2. Quality Guidelines

- Keep answers concise (2-3 sentences)
- Use friendly, welcoming tone
- Include specific details when relevant
- Avoid overly technical language

### 3. Testing

After updating FAQs:

1. Test with your FAQ trigger phrase
2. Verify embedding generation works
3. Check response accuracy
4. Monitor user satisfaction

### 4. Analytics

Track which FAQs are most requested:

- Monitor conversation logs
- Identify knowledge gaps
- Add missing information

## Migration from Kuruhouse FAQs

If migrating from Kuruhouse-specific FAQs:

1. **Replace Organization Name**
   - Change "クルハウス" to your organization name
   - Update trigger phrases accordingly

2. **Update Activity References**
   - Change "ボランティア活動" to your activity type
   - Adjust context-specific information

3. **Customize Location/Time Info**
   - Update meeting locations
   - Correct activity schedules
   - Fix contact information

4. **Test Migration**
   - Verify all responses make sense
   - Check for broken references
   - Confirm trigger phrases work

Example migration:

```diff
- 質問: クルハウスの活動時間は？
+ 質問: [組織名]の活動時間は？

- 回答: クルハウスでは毎週土曜日...
+ 回答: [組織名]では毎週[曜日]...
```
