import { SyntaxHighlighter } from "@/components/shared/SyntaxHighlighter";

export function Usage() {
  return (
    <div>
      <SyntaxHighlighter language="jsx">{`import { isRef } from "@/utils/isRef";
import { ref, reactive } from "vue";

const myRef = ref('Hello');
const myObj = { text: 'World' };
const myReactive = reactive({ text: 'World' });

console.log(isRef(myRef));      // true
console.log(isRef(myObj));      // false
console.log(isRef(myReactive)); // false`}</SyntaxHighlighter>
    </div>
  );
} 