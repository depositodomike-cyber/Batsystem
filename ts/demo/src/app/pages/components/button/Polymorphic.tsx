// Import Dependencies
import { Link } from "react-router";

// Local Imports
import { Button } from "@/components/ui";

// ----------------------------------------------------------------------

const Polymorphic = () => {
  return (
    <>
      <Button component={Link} to="/" color="primary" isGlow>
        Primary
      </Button>
    </>
  );
};

export { Polymorphic };
