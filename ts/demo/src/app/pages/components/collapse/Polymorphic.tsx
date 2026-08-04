// Local Imports
import { Collapse, Button, ScrollShadow } from "@/components/ui";
import { useDisclosure } from "@/hooks";

// ----------------------------------------------------------------------

export function Polymorphic() {
  const [isExpanded, { toggle }] = useDisclosure();

  return (
    <div className="max-w-xl">
      <Button onClick={toggle} color="primary">
        Toggle
      </Button>
      <div className="mt-2">
        <Collapse in={isExpanded} component={ScrollShadow} min="80px">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Beatae fugit,
          recusandae architecto iste qui obcaecati molestias officiis possimus
          sint, fuga vero. Harum sed, nesciunt repellendus culpa, pariatur
          expedita eveniet ipsa magnam voluptatem excepturi ipsum dolorum
          blanditiis placeat quidem iusto, provident suscipit obcaecati facilis
          corrupti omnis cum quia quo ab ea! Quis ullam accusamus vitae fuga
          omnis veritatis voluptatum voluptatibus quae explicabo, minima eos
          laudantium mollitia officiis a dignissimos expedita ad perspiciatis
          libero minus aspernatur! Modi facilis saepe cumque atque inventore at
          culpa commodi hic ex harum sapiente neque consectetur, incidunt
          expedita corrupti iste quo qui ullam a dolor distinctio similique!
        </Collapse>
      </div>
    </div>
  );
}
