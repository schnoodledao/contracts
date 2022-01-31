namespace SchnoodleDApp.Extensions;

public static class EnumerableExtensions
{
    public static IReadOnlyCollection<T> AsReadOnly<T>(this IEnumerable<T> items) => Array.AsReadOnly(items.ToArrayOrCast());

    public static T[] ToArrayOrCast<T>(this IEnumerable<T> items) => items as T[] ?? items.ToArray();
}
