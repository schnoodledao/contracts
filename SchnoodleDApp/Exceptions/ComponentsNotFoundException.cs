using SchnoodleDApp.Extensions;
// ReSharper disable UnusedMember.Global

namespace SchnoodleDApp.Exceptions;

public class ComponentsNotFoundException : Exception
{
    public IReadOnlyCollection<string>? Components { get; }

    public ComponentsNotFoundException()
    {
    }

    public ComponentsNotFoundException(string message)
        : base(message)
    {
    }

    public ComponentsNotFoundException(string message, Exception inner)
        : base(message, inner)
    {
    }

    public ComponentsNotFoundException(string message, IEnumerable<string> components)
        : base(message)
    {
        Components = components.AsReadOnly();
    }

    public ComponentsNotFoundException(string message, IEnumerable<string> components, Exception inner)
        : base(message, inner)
    {
        Components = components.AsReadOnly();
    }

    public override string ToString()
    {
        return Components?.Any() == true ? $"Invalid components: ${String.Join(',', Components)}${Environment.NewLine}${base.ToString()}" : String.Empty;
    }
}
