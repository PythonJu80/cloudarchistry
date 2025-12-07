"use client";

import { useState } from "react";
import {
  Plus,
  ListTodo,
  Sparkles,
  ChevronLeft,
  Check,
  X,
  Clock,
  Target,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  category: string;
  questions: QuizQuestion[];
  timeLimit?: number; // minutes
}

// Placeholder quizzes
const placeholderQuizzes: Quiz[] = [
  {
    id: "1",
    title: "IAM Quick Check",
    description: "Test your knowledge of AWS Identity and Access Management",
    category: "Security",
    timeLimit: 5,
    questions: [
      {
        id: "q1",
        question: "Which IAM entity is used to delegate access to AWS services?",
        options: ["IAM User", "IAM Group", "IAM Role", "IAM Policy"],
        correctIndex: 2,
        explanation: "IAM Roles are used to delegate access. They can be assumed by users, applications, or AWS services to gain temporary credentials.",
      },
      {
        id: "q2",
        question: "What is the maximum size of an IAM policy document?",
        options: ["2 KB", "5 KB", "6 KB", "10 KB"],
        correctIndex: 2,
        explanation: "The maximum size for a managed policy is 6,144 characters (approximately 6 KB).",
      },
      {
        id: "q3",
        question: "Which statement about IAM is correct?",
        options: [
          "IAM is regional",
          "IAM is global",
          "IAM requires a VPC",
          "IAM has a monthly cost"
        ],
        correctIndex: 1,
        explanation: "IAM is a global service. Users, groups, roles, and policies are available across all AWS regions.",
      },
    ],
  },
  {
    id: "2",
    title: "S3 Fundamentals",
    description: "Core concepts of Amazon Simple Storage Service",
    category: "Storage",
    timeLimit: 10,
    questions: [
      {
        id: "s1",
        question: "What is the maximum size of a single S3 object?",
        options: ["5 GB", "5 TB", "50 TB", "Unlimited"],
        correctIndex: 1,
        explanation: "The maximum size of a single S3 object is 5 TB. For objects larger than 5 GB, you must use multipart upload.",
      },
    ],
  },
];

export default function QuizPage() {
  const [quizzes] = useState<Quiz[]>(placeholderQuizzes);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [quizComplete, setQuizComplete] = useState(false);

  const currentQuestion = activeQuiz?.questions[currentQuestionIndex];
  const isCorrect = selectedAnswer === currentQuestion?.correctIndex;

  const startQuiz = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setAnswers(new Array(quiz.questions.length).fill(null));
    setQuizComplete(false);
  };

  const submitAnswer = () => {
    if (selectedAnswer === null) return;
    
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = selectedAnswer;
    setAnswers(newAnswers);
    setShowResult(true);
  };

  const nextQuestion = () => {
    if (!activeQuiz) return;
    
    if (currentQuestionIndex < activeQuiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setQuizComplete(true);
    }
  };

  const exitQuiz = () => {
    setActiveQuiz(null);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setAnswers([]);
    setQuizComplete(false);
  };

  // Quiz complete view
  if (activeQuiz && quizComplete) {
    const correctCount = answers.filter((a, i) => a === activeQuiz.questions[i].correctIndex).length;
    const score = Math.round((correctCount / activeQuiz.questions.length) * 100);
    
    return (
      <div className="p-6">
        <div className="max-w-xl mx-auto text-center py-12">
          <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${
            score >= 80 ? "bg-green-500/20" : score >= 60 ? "bg-amber-500/20" : "bg-red-500/20"
          }`}>
            <Trophy className={`w-10 h-10 ${
              score >= 80 ? "text-green-400" : score >= 60 ? "text-amber-400" : "text-red-400"
            }`} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
          <p className="text-muted-foreground mb-6">{activeQuiz.title}</p>
          
          <div className="p-6 rounded-xl bg-muted/30 border border-border/50 mb-6">
            <div className="text-4xl font-bold mb-2">{score}%</div>
            <p className="text-muted-foreground">
              {correctCount} of {activeQuiz.questions.length} correct
            </p>
          </div>
          
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={exitQuiz}>
              Back to quizzes
            </Button>
            <Button onClick={() => startQuiz(activeQuiz)}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active quiz view
  if (activeQuiz && currentQuestion) {
    return (
      <div className="p-6">
        {/* Quiz Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={exitQuiz}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Exit quiz
            </Button>
            <div>
              <h2 className="font-semibold">{activeQuiz.title}</h2>
              <p className="text-sm text-muted-foreground">
                Question {currentQuestionIndex + 1} of {activeQuiz.questions.length}
              </p>
            </div>
          </div>
          <Progress 
            value={((currentQuestionIndex + 1) / activeQuiz.questions.length) * 100} 
            className="w-32 h-2" 
          />
        </div>

        {/* Question */}
        <div className="max-w-2xl mx-auto">
          <div className="p-6 rounded-xl bg-muted/30 border border-border/50 mb-6">
            <p className="text-lg font-medium">{currentQuestion.question}</p>
          </div>

          {/* Options */}
          <div className="space-y-3 mb-6">
            {currentQuestion.options.map((option, index) => {
              let optionClass = "border-border/50 hover:border-primary/50";
              
              if (showResult) {
                if (index === currentQuestion.correctIndex) {
                  optionClass = "border-green-500 bg-green-500/10";
                } else if (index === selectedAnswer && !isCorrect) {
                  optionClass = "border-red-500 bg-red-500/10";
                }
              } else if (selectedAnswer === index) {
                optionClass = "border-primary bg-primary/10";
              }
              
              return (
                <button
                  key={index}
                  onClick={() => !showResult && setSelectedAnswer(index)}
                  disabled={showResult}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${optionClass}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-medium ${
                      showResult && index === currentQuestion.correctIndex
                        ? "border-green-500 text-green-400"
                        : showResult && index === selectedAnswer && !isCorrect
                        ? "border-red-500 text-red-400"
                        : selectedAnswer === index
                        ? "border-primary text-primary"
                        : "border-border"
                    }`}>
                      {showResult && index === currentQuestion.correctIndex ? (
                        <Check className="w-4 h-4" />
                      ) : showResult && index === selectedAnswer && !isCorrect ? (
                        <X className="w-4 h-4" />
                      ) : (
                        String.fromCharCode(65 + index)
                      )}
                    </div>
                    <span>{option}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {showResult && (
            <div className={`p-4 rounded-xl mb-6 ${
              isCorrect ? "bg-green-500/10 border border-green-500/30" : "bg-amber-500/10 border border-amber-500/30"
            }`}>
              <p className="font-medium mb-1">
                {isCorrect ? "Correct!" : "Not quite right"}
              </p>
              <p className="text-sm text-muted-foreground">
                {currentQuestion.explanation}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center">
            {!showResult ? (
              <Button onClick={submitAnswer} disabled={selectedAnswer === null}>
                Submit Answer
              </Button>
            ) : (
              <Button onClick={nextQuestion}>
                {currentQuestionIndex < activeQuiz.questions.length - 1 ? "Next Question" : "See Results"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Quiz list view
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Quiz</h1>
          <p className="text-muted-foreground">
            Test your knowledge with quick quizzes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Sparkles className="w-4 h-4 mr-2" />
            Generate from sources
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create quiz
          </Button>
        </div>
      </div>

      {/* Quizzes Grid */}
      {quizzes.length === 0 ? (
        <div className="text-center py-20">
          <ListTodo className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No quizzes yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Create quizzes manually or generate them from your learning sources.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate from sources
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create quiz
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="p-5 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <Badge variant="secondary">{quiz.category}</Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {quiz.timeLimit && (
                    <>
                      <Clock className="w-4 h-4" />
                      {quiz.timeLimit}m
                    </>
                  )}
                </div>
              </div>
              <h3 className="font-semibold mb-1">{quiz.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{quiz.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Target className="w-4 h-4" />
                  {quiz.questions.length} questions
                </div>
                <Button size="sm" onClick={() => startQuiz(quiz)}>
                  Start Quiz
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
