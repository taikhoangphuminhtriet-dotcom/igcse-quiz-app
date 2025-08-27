# Quiz Syntax Guide for Developers

This guide explains the special syntax patterns available when creating and editing quizzes in the IGCSE Quiz App.

## Table of Contents
1. [Answer Modes](#answer-modes)
2. [Flexible Answer Syntax](#flexible-answer-syntax)
3. [Question Types](#question-types)
4. [Quiz Status Management](#quiz-status-management)
5. [Best Practices](#best-practices)

---

## Answer Modes

When creating quiz questions, you can specify different answer validation modes to control how student answers are checked.

### 1. Static Mode (Exact Match)
**Syntax:** `!static! answer`

Use this for answers that must match exactly.

**Example:**
```
Question: What is the capital of France?
Answer: !static! Paris
```
The student must type "Paris" exactly (case-insensitive).

### 2. Keywords Mode (Partial Match)
**Syntax:** `!keywords! keyword1 | keyword2 | keyword3`

Use this when the answer should contain specific keywords.

**Example:**
```
Question: Explain photosynthesis briefly.
Answer: !keywords! sunlight | carbon dioxide | glucose | oxygen
```
The student's answer must contain at least some of these keywords.

### 3. AI Mode (Intelligent Comparison)
**Syntax:** `!ai! reference text`

Use this for complex answers that need intelligent comparison.

**Example:**
```
Question: Describe the water cycle.
Answer: !ai! The water cycle involves evaporation from water bodies, condensation in clouds, precipitation as rain or snow, and collection in rivers and oceans.
```
The AI will compare the student's answer against this reference for conceptual accuracy.

---

## Flexible Answer Syntax

These patterns allow for variations in student answers without marking them wrong.

### 1. Plural/Singular Forms
**Syntax:** `word%s%`

**Example:**
```
Answer: The cell%s% divide%s% rapidly
```
Accepts: "The cell divides rapidly" OR "The cells divide rapidly"

### 2. Word Form Variations
**Syntax:** `word%form-w%`

**Example:**
```
Answer: The process is accelerate%form-w%
```
Accepts: "accelerate", "accelerating", "accelerated", "acceleration"

### 3. Tense Variations
**Syntax:** `word%form-t%`

**Example:**
```
Answer: The enzyme break%form-t% down proteins
```
Accepts: "breaks", "broke", "breaking", "will break"

### Combining Syntaxes
You can combine multiple patterns:
```
Answer: !keywords! enzyme%s% | protein%s% | break%form-t% down
```

---

## Question Types

### 1. Multiple Choice
```json
{
  "type": "multiple_choice",
  "question": "What is 2+2?",
  "options": ["3", "4", "5", "6"],
  "correctAnswer": 1,  // Index of correct option (0-based)
  "marks": 1
}
```

### 2. Short Answer
```json
{
  "type": "short_answer",
  "question": "Name the process by which plants make food",
  "correctAnswer": "!keywords! photosynthesis | sunlight | chlorophyll",
  "marks": 2
}
```

### 3. Calculation
```json
{
  "type": "calculation",
  "question": "Calculate the area of a rectangle with length 5m and width 3m",
  "correctAnswer": "!static! 15",
  "marks": 3,
  "unit": "m²"
}
```

### 4. Essay
```json
{
  "type": "essay",
  "question": "Discuss the causes of World War I",
  "correctAnswer": "!ai! World War I was caused by militarism, alliances, imperialism, and nationalism, triggered by the assassination of Archduke Franz Ferdinand.",
  "marks": 10
}
```

---

## Quiz Status Management

### Draft vs Published

When AI generates a quiz, it starts in **draft** status:

1. **Draft Status**
   - Only visible to developers/owners
   - Can be edited freely
   - Can be deleted
   - Not available for students to take

2. **Published Status**
   - Visible to all students
   - Cannot be deleted (to preserve test history)
   - Edits should be done carefully
   - Students can take the quiz

### Publishing Workflow

1. **AI Generation** → Quiz created as draft
2. **Review & Edit** → Developer reviews and edits questions
3. **Save Edits** → Changes saved, quiz remains in draft
4. **Publish** → Quiz becomes available to students

### API Endpoints

```javascript
// Get all quizzes (developers only, includes drafts)
GET /api/all-quizzes?status=draft

// Get published quizzes (for students)
GET /api/quizzes

// Publish a quiz
POST /api/publish-quiz/:quizId

// Update quiz (while in draft)
PUT /api/quiz/:quizId
```

---

## Best Practices

### 1. Question Writing
- Be clear and unambiguous
- Specify marks based on difficulty (1-3 easy, 4-6 medium, 7-10 hard)
- Include explanations for complex answers

### 2. Answer Validation
- Use **static mode** for factual answers (dates, names, formulas)
- Use **keywords mode** for concept-based answers
- Use **AI mode** for essay-type questions requiring understanding
- Always test flexible syntax patterns before publishing

### 3. Reading Comprehension
When creating reading comprehension questions:
- Provide substantial passages (200-400 words)
- Highlight key sentences that contain answers
- Reference both passage and mark scheme in explanations

### 4. Mark Schemes
- Be consistent with marking across similar questions
- Consider partial credit for complex questions
- Document any special marking considerations

### 5. XP System Integration
Remember that the XP system considers:
- **First attempt bonus**: Full XP only on first attempt
- **Combo multiplier**: Consecutive correct answers
- **Time bonus**: 5-7 PM daily (1.3x multiplier)
- **Early bird**: Within 2 hours of publication (+20 XP)
- **Perfect score**: No wrong answers (1.2x multiplier)

---

## Examples

### Complete Question with All Features

```json
{
  "id": "q1",
  "type": "short_answer",
  "question": "Describe how enzyme%s% function in digestion",
  "passage": "Enzymes are biological catalysts that speed up chemical reactions...",
  "highlightedSentences": [
    {
      "sentence": "Enzymes break down large molecules into smaller ones",
      "reason": "Key concept for the answer"
    }
  ],
  "correctAnswer": "!keywords! enzyme%s% | catalyst%s% | break%form-t% down | substrate | active site",
  "answerMode": "keywords",
  "marks": 4,
  "explanation": "Enzymes are biological catalysts that break down large food molecules into smaller ones through their active sites binding to specific substrates.",
  "markSchemeReference": "Accept any mention of catalysis and substrate specificity"
}
```

### Multi-PDF Quiz Generation

When uploading PDFs for AI quiz generation:
1. **Insert Sheet**: Contains formulas, constants, and reference material
2. **Questions Paper**: The actual exam questions
3. **Mark Scheme**: Official answers and marking guidelines

The AI will:
- Extract questions from the questions paper
- Use the mark scheme for accurate answers
- Reference the insert sheet for formulas
- Create reading passages for comprehension
- Generate detailed explanations

---

## Troubleshooting

### Common Issues

1. **Quiz not showing for students**
   - Check if quiz status is "published"
   - Verify quiz has required fields (title, subject, questions)

2. **Answer marked wrong incorrectly**
   - Review answer mode (static/keywords/ai)
   - Check for typos in flexible syntax
   - Test with exact expected answer

3. **XP not calculated correctly**
   - Verify it's truly a first attempt
   - Check if previous test was completed (not abandoned)
   - Ensure test was submitted properly

---

## Support

For additional help or to report issues:
- Check the backend logs for detailed error messages
- Review the test_history collection for submission details
- Contact the development team with specific quiz IDs

---

*Last updated: December 2024*