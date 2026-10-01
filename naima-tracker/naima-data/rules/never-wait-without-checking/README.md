# Never wait without checking

Do not wait indefinitely on another task. Every wait has a short check interval. At each check, verify progress by examining recent commits or file changes and confirming the target process is still alive. When there is spare capacity and the target still has open work, start the next unit instead of waiting. A long wait is a decision, made only when the answer cannot exist otherwise—and only after verifying its precondition.

Why: a coordinator sat waiting on one slow job while about a hundred items stayed open and the machine was idle. Waiting without checking wastes capacity and masks stalls.
